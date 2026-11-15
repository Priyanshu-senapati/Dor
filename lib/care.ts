import { after } from "next/server";
import { sql } from "./db";
import { doseRef, notifyHandled, notifyOwner } from "./notify";
import { appUrl, sendMail } from "./mail";
import { addTrail, raise } from "./alerts";
import { doseOutcome } from "./outcomes";
import { onDuty } from "./chain";
import { visitCalendarLink } from "./gcal";
import { handoffBriefing } from "./gemini";
import { SKIP_REASONS } from "./symptoms";
import { addDays, doseInstant, istDate, showDay, showTime, showWhen } from "./time";
import type { Alert, Appointment, Med, Member, Profile } from "./types";

export const isUuid = (s: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function logEvent(profileId: string, memberId: string | null, kind: string, label: string, alertId: string | null = null): Promise<void> {
  await sql`insert into events (profile_id, member_id, kind, label, alert_id) values (${profileId}, ${memberId}, ${kind}, ${label}, ${alertId})`;
}

const medName = (m: Pick<Med, "brand" | "dose">) => `${m.brand}${m.dose ? ` ${m.dose}` : ""}`;
const firstName = (p: Profile) => p.elder_name.split(" ")[0];

/** Resolve the open alert with this key, and note how it ended on its trail. */
async function resolveByKey(profile: Profile, refKey: string, resolution: string, by: Member | null): Promise<void> {
  // A resolved refill frees its key, so the same medicine can raise a fresh refill task later.
  const done = await sql<{ id: string }>`update alerts set status = 'resolved', resolution = ${resolution},
      ref_key = case when kind = 'refill' then ref_key || ':' || id else ref_key end
    where profile_id = ${profile.id} and ref_key = ${refKey} and status <> 'resolved' returning id`;
  for (const a of done) await addTrail(profile.id, a.id, by?.id ?? null, `Resolved: ${resolution}.`);
}

/** Mark a scheduled dose taken or skipped; resolves its alert. Shared by the app and one-click email links. */
export async function recordDose(
  profile: Profile,
  by: Member,
  medId: string,
  atMs: number,
  status: "taken" | "skipped",
  reason: string,
): Promise<string> {
  if (!isUuid(medId) || !Number.isFinite(atMs)) return "That dose couldn't be found.";
  const [med] = await sql<Med>`select * from medications where id = ${medId} and profile_id = ${profile.id}`;
  if (!med) return "That dose couldn't be found.";
  const at = new Date(atMs);
  // One statement: lock the old row, write the new status, report whether this call changed it.
  // Two people tapping "Taken" at once then move the tablet count only once.
  const [r] = await sql<{ prev: string | null; changed: number }>`
    with old as (select status from dose_logs where med_id = ${med.id} and at = ${at} for update),
    up as (
      insert into dose_logs (med_id, profile_id, at, status, reason, marked_by)
      values (${med.id}, ${profile.id}, ${at}, ${status}, ${reason}, ${by.id})
      on conflict (med_id, at) do update set status = excluded.status, reason = excluded.reason,
        marked_by = excluded.marked_by, marked_at = now()
      where dose_logs.status is distinct from excluded.status or dose_logs.reason is distinct from excluded.reason
      returning 1
    )
    select (select status from old) as prev, (select count(*) from up)::int as changed`;
  const changed = (r?.changed ?? 0) > 0;
  const wasTaken = r?.prev === "taken";
  if (changed && status === "taken" && !wasTaken) {
    await sql`update medications set pills_left = greatest(pills_left - pills_per_dose, 0) where id = ${med.id} and pills_left is not null`;
  } else if (changed && status !== "taken" && wasTaken) {
    await sql`update medications set pills_left = pills_left + pills_per_dose where id = ${med.id} and pills_left is not null`;
  }

  const by_ = by.role === "elder" ? "" : ` (marked by ${by.name})`;
  const label =
    status === "taken"
      ? `${profile.elder_name} took ${medName(med)} (${showTime(at)})${by_}`
      : `${profile.elder_name} chose to skip ${medName(med)} (${showTime(at)})${reason ? `: ${reason}` : ""}${by_}`;

  if (status === "skipped" && changed) {
    await logEvent(profile.id, by.id, "skip", label);
    const symptom = SKIP_REASONS.find((s) => s.label === reason)?.symptom;
    if (symptom) {
      await sql`insert into symptoms (profile_id, member_id, name, note) values (${profile.id}, ${by.id}, ${symptom}, ${`Gave it as the reason to skip ${med.brand}`})`;
    }
  }
  await resolveByKey(profile, `dose:${med.id}:${atMs}`, label, by);
  return status === "taken" ? "Marked as taken. Thank you!" : "Noted. Your family will see the reason, not a red alarm.";
}

export async function claimEscort(profile: Profile, chain: Member[], apptId: string, by: Member): Promise<string> {
  if (!isUuid(apptId)) return "That appointment couldn't be found.";
  const [appt] = await sql<Appointment>`update appointments set escort_id = ${by.id}
    where id = ${apptId} and profile_id = ${profile.id} and escort_id is null returning *`;
  if (!appt) return "Someone is already taking them.";
  const label = `${by.name} will take ${profile.elder_name} to ${appt.doctor} (${showWhen(appt.starts_at)})`;
  await sql`update alerts set acked_by = ${by.id}, acked_at = now() where profile_id = ${profile.id} and ref_key = ${`escort:${appt.id}`}`;
  await resolveByKey(profile, `escort:${appt.id}`, label, by);
  await logEvent(profile.id, by.id, "escort", label);
  const first = firstName(profile);
  await Promise.all([
    ...chain.filter((m) => m.id !== by.id).map((m) => sendMail(m.email, label, ["No need to arrange anything else unless they ask for help."])),
    sendMail(by.email, `You’re taking ${first} to ${appt.doctor}`, [
      `${showWhen(appt.starts_at)}${appt.location ? ` at ${appt.location}` : ""}.`,
      "Everyone else in the circle has been told. Add it to your calendar so it isn’t forgotten.",
    ], [{ label: "Add to Google Calendar", href: visitCalendarLink(appt, first, by.name, appUrl()) }]),
  ]);
  return "Thanks! Everyone knows you're taking them.";
}

/** "I'm on it": one owner, everyone else told, escalation stops. */
export async function ackAlert(profile: Profile, chain: Member[], alertId: string, by: Member): Promise<string> {
  if (!isUuid(alertId)) return "That alert couldn't be found.";
  const [alert] = await sql<Alert>`update alerts set status = 'acked', acked_by = ${by.id}, acked_at = now()
    where id = ${alertId} and profile_id = ${profile.id} and status = 'open' returning *`;
  if (!alert) {
    const [cur] = await sql<{ name: string | null }>`select m.name from alerts a left join members m on m.id = a.acked_by
      where a.id = ${alertId} and a.profile_id = ${profile.id}`;
    return cur?.name ? `${cur.name} already has this one.` : "This one is already handled.";
  }
  if (alert.kind === "escort") return claimEscort(profile, chain, alert.ref_key.split(":")[1] ?? "", by);
  await logEvent(profile.id, by.id, "ack", `${by.name}: “I’m on it.”`, alert.id);
  await notifyHandled(alert, by, chain);
  return "Thanks! Everyone knows you're on it, and Dor has stopped passing it on.";
}

export async function resolveAlert(profile: Profile, alertId: string, by: Member, note: string): Promise<void> {
  if (!isUuid(alertId)) return;
  const [a] = await sql<{ ref_key: string }>`select ref_key from alerts where id = ${alertId} and profile_id = ${profile.id}`;
  if (a) await resolveByKey(profile, a.ref_key, note || `Done (${by.name})`, by);
}

/**
 * "What happened?" for a missed dose someone has picked up. Turns a vague alarm into a fact:
 * taken, later, skipped and why, ran out (opens a refill task), or couldn't reach them (passes it on now).
 */
export async function reportOutcome(profile: Profile, chain: Member[], alertId: string, outcomeId: string, by: Member): Promise<string> {
  const outcome = doseOutcome(outcomeId);
  if (!outcome || !isUuid(alertId)) return "That choice isn't available.";
  const [alert] = await sql<Alert>`select * from alerts where id = ${alertId} and profile_id = ${profile.id}`;
  const dose = alert ? doseRef(alert.ref_key) : null;
  if (!alert || !dose) return "That alert couldn't be found.";
  if (alert.status === "resolved") return "This one is already resolved.";
  const first = firstName(profile);
  if (outcome.pass && alert.status === "acked" && alert.acked_by !== by.id) {
    return "Someone else is handling this one. Only they can pass it on.";
  }

  // Answering "what happened" means you've picked it up.
  if (alert.status === "open" && !outcome.pass) {
    await sql`update alerts set status = 'acked', acked_by = ${by.id}, acked_at = now() where id = ${alert.id} and status = 'open'`;
  }
  await logEvent(profile.id, by.id, "outcome", `${by.name}: ${outcome.label(first)}.`, alert.id);

  if (outcome.later) return "Noted. It stays with you until the dose is marked.";

  if (outcome.pass) {
    const note = `${by.name} couldn’t reach ${first}.`;
    const nextIdx = Math.max(alert.level, chain.findIndex((m) => m.id === by.id)) + 1;
    const owner = chain[nextIdx];
    if (owner) {
      const [moved] = await sql<Alert>`update alerts set status = 'open', acked_by = null, acked_at = null,
          level = ${nextIdx}, owner_id = ${owner.id}, last_notified_at = now()
        where id = ${alert.id} and status <> 'resolved' returning *`;
      if (!moved) return "This one was resolved a moment ago.";
      await addTrail(profile.id, alert.id, null, `Passed to ${owner.name} straight away.`);
      await notifyOwner(profile, moved, owner, chain, `${note} Can you check on ${first}?`);
      return `Passed to ${owner.name} straight away, with your note.`;
    }
    await sql`update alerts set status = 'open', acked_by = null, acked_at = null where id = ${alert.id} and status <> 'resolved'`;
    await Promise.all(
      chain.filter((m) => m.id !== by.id && m.role !== "elder").map((m) => sendMail(m.email, `Can anyone reach ${first}?`, [note, alert.title])),
    );
    return `Everyone else in the circle has been asked to check on ${first}.`;
  }

  let msg = outcome.dose ? await recordDose(profile, by, dose.med, dose.at, outcome.dose, outcome.reason ?? "") : "";
  if (outcome.refill) {
    const [med] = await sql<Med>`update medications set pills_left = 0 where id = ${dose.med} and profile_id = ${profile.id} returning *`;
    if (med) {
      const level = Math.max(0, chain.findIndex((m) => m.id === by.id));
      await raise(profile, chain, "refill", `refill:${med.id}`, `${med.brand} has run out`,
        `${by.name} found ${first} has no ${med.brand} left. Someone needs to buy more today.`, level, { notify: false });
      await addTrail(profile.id, alert.id, null, `Refill task opened for ${med.brand}.`);
      msg += ` A refill task for ${med.brand} is on Today, with you.`;
    }
  }
  return msg.trim();
}

/** "I'll buy it": claim (or open and claim) the refill task for a medicine. */
export async function claimRefill(profile: Profile, chain: Member[], medId: string, by: Member): Promise<string> {
  if (!isUuid(medId)) return "Medicine not found.";
  const [med] = await sql<Med>`select * from medications where id = ${medId} and profile_id = ${profile.id}`;
  if (!med) return "Medicine not found.";
  const level = Math.max(0, chain.findIndex((m) => m.id === by.id));
  await raise(profile, chain, "refill", `refill:${med.id}`, `${med.brand} is running out`,
    `Only ${med.pills_left ?? 0} left. Someone needs to buy more before ${profile.elder_name} runs out.`, level, { notify: false });
  const [alert] = await sql<{ id: string }>`select id from alerts where profile_id = ${profile.id} and ref_key = ${`refill:${med.id}`}`;
  return alert ? ackAlert(profile, chain, alert.id, by) : "Couldn't open the refill task.";
}

const dayRange = (from: string, to: string) =>
  `${showDay(new Date(`${from}T12:00:00+05:30`))} to ${showDay(new Date(`${to}T12:00:00+05:30`))}`;

/**
 * Move every open care event a member holds to their cover, at the cover's place in today's chain.
 * Used when a handoff starts today, and by each reminder check while someone is away.
 */
export async function reassignTo(profile: Profile, duty: Member[], fromId: string, fromName: string, cover: Member): Promise<Alert[]> {
  const level = Math.max(0, duty.findIndex((m) => m.id === cover.id));
  const moved = await sql<Alert>`update alerts set owner_id = ${cover.id}, level = ${level},
      acked_by = case when acked_by = ${fromId} then ${cover.id}::uuid else acked_by end
    where profile_id = ${profile.id} and status <> 'resolved' and (owner_id = ${fromId} or acked_by = ${fromId}) returning *`;
  for (const a of moved) await addTrail(profile.id, a.id, null, `Handed to ${cover.name}: ${fromName} is away.`);
  return moved;
}

/** What the person covering needs to know, in a few sentences (Gemini if configured, plain text otherwise). */
async function briefCover(profile: Profile, by: Member, cover: Member, range: string, items: string[]) {
  const today = istDate(new Date());
  const [meds, skips] = await Promise.all([
    sql<Med>`select * from medications where profile_id = ${profile.id} and status = 'active' order by brand limit 20`,
    sql<{ label: string }>`select label from events where profile_id = ${profile.id} and kind = 'skip'
      and at > now() - interval '7 days' order by at desc limit 5`,
  ]);
  return handoffBriefing({
    elderFirst: firstName(profile),
    from: by.name,
    to: cover.name,
    range,
    items,
    meds: meds.map((m) => `${medName(m)} at ${m.times.map((t) => showTime(doseInstant(today, t))).join(" and ")}${m.instructions ? `, ${m.instructions}` : ""}`),
    recent: skips.map((s) => s.label),
  });
}

/** Handoff: while someone is away, the chain skips them and their open items move to their cover. */
export async function setAway(profile: Profile, chain: Member[], by: Member, coverId: string, startsOn: string, endsOn: string): Promise<string> {
  const cover = chain.find((m) => m.id === coverId && m.id !== by.id && m.role !== "elder");
  if (!cover) return "Pick someone else in the circle to cover.";
  const [busy] = await sql`select 1 from away where profile_id = ${profile.id} and member_id = ${cover.id}
    and starts_on <= ${endsOn} and ends_on >= ${startsOn}`;
  if (busy) return `${cover.name} is away during those dates too. Pick someone else.`;
  const [row] = await sql<{ id: string }>`insert into away (profile_id, member_id, cover_id, starts_on, ends_on)
    values (${profile.id}, ${by.id}, ${cover.id}, ${startsOn}, ${endsOn}) returning id`;
  const range = dayRange(startsOn, endsOn);
  const today = istDate(new Date());
  const moved: string[] = [];
  if (startsOn <= today) {
    const away = await sql<{ member_id: string; starts_on: string; ends_on: string }>`select member_id, starts_on, ends_on
      from away where profile_id = ${profile.id}`;
    moved.push(...(await reassignTo(profile, onDuty(chain, away, today), by.id, by.name, cover)).map((a) => a.title));
  }
  // Only future visits move; past visits keep who actually took them.
  const visits = await sql<Appointment>`update appointments set escort_id = ${cover.id}
    where profile_id = ${profile.id} and escort_id = ${by.id} and starts_at > now()
      and starts_at >= ${new Date(`${startsOn}T00:00:00+05:30`)} and starts_at < ${new Date(`${addDays(endsOn, 1)}T00:00:00+05:30`)}
    returning *`;
  moved.push(...visits.map((v) => `taking ${profile.elder_name} to ${v.doctor} (${showWhen(v.starts_at)})`));

  await logEvent(profile.id, by.id, "handoff", `${by.name} is away ${range}. ${cover.name} is covering.`);
  // Writing the briefing can take a while (Gemini), so it happens after the handoff is confirmed.
  after(async () => {
    try {
      const briefing = await briefCover(profile, by, cover, range, moved);
      await sql`update away set briefing = ${briefing.text}, briefing_ai = ${briefing.ai} where id = ${row.id}`;
      await sendMail(cover.email, `You’re covering for ${by.name}, ${range}`, [
        `${by.name} is away ${range}. While they’re away, Dor skips them and their alerts come to you.`,
        briefing.text,
        briefing.ai ? "This briefing was written by Google Gemini from Dor’s records. It is not medical advice." : "",
      ].filter(Boolean), [{ label: "Open Dor", href: `${appUrl()}/p` }]);
    } catch (err) {
      console.error("[handoff] briefing failed:", err instanceof Error ? err.message : "unknown error");
    }
  });
  return `Done. ${cover.name} is covering ${range}${moved.length ? ` and now owns ${moved.length} item${moved.length > 1 ? "s" : ""}` : ""}. A briefing is on its way to ${cover.name}.`;
}

export async function endAway(profile: Profile, awayId: string, by: Member): Promise<string> {
  if (!isUuid(awayId)) return "Not found.";
  const [a] = await sql<{ id: string }>`delete from away where id = ${awayId} and profile_id = ${profile.id} returning id`;
  if (a) await logEvent(profile.id, by.id, "handoff", `${by.name} marked a cover period as over.`);
  return a ? "Welcome back. The chain is back to normal." : "Already ended.";
}

/**
 * Puts an approved (or elder-made) medicine into the schedule, retiring the one it replaces.
 * Returns false (and declines it) if the medicine it was meant to change has already changed.
 */
export async function activateMed(profile: Profile, med: Med, by: Member): Promise<boolean> {
  let kind = "med_start";
  let label = `Started ${medName(med)}`;
  if (med.replaces_id) {
    const [old] = await sql<Med>`update medications set status = 'stopped', end_date = ${istDate(new Date())}
      where id = ${med.replaces_id} and profile_id = ${profile.id} and status = 'active' returning *`;
    if (!old) {
      await sql`update medications set status = 'declined' where id = ${med.id}`;
      return false;
    }
    kind = "med_change";
    label = `${medName(old)} → ${medName(med)}`;
  }
  // The schedule starts now, so doses earlier today aren't counted as missed.
  await sql`update medications set status = 'active', created_at = now() where id = ${med.id}`;
  await logEvent(profile.id, by.id, kind, label);
  return true;
}

export { medName };
