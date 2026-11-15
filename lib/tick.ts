import { sql } from "./db";
import { orderChain, nextLevel, firstHelper, onDuty } from "./chain";
import { slotsForDay, classifySlot, slotKey, visitHeading } from "./schedule";
import { addDays, istDate, showTime, showWhen } from "./time";
import { actionLink, notifyOwner } from "./notify";
import { sendMail } from "./mail";
import { medName, reassignTo } from "./care";
import { addTrail, raise } from "./alerts";
import type { Alert, Appointment, Med, Member, Profile } from "./types";

export const REFILL_DAYS = 3;
export const ESCORT_ASK_HOURS = 48;
const ALERT_LOOKBACK_MS = 12 * 3_600_000; // don't raise alarms for doses older than this (e.g. after downtime)

/** True the first time a key is seen; makes every email idempotent across overlapping runs. */
async function once(key: string): Promise<boolean> {
  return (await sql`insert into sent_keys (key) values (${key}) on conflict do nothing returning key`).length > 0;
}

/** The chain on duty today: ordered, minus anyone away (their cover is already in it). */
export async function dutyChain(profileId: string, date: string): Promise<Member[]> {
  const [members, away] = await Promise.all([
    sql<Member>`select * from members where profile_id = ${profileId}`,
    sql<{ member_id: string; starts_on: string; ends_on: string }>`select member_id, starts_on, ends_on from away where profile_id = ${profileId}`,
  ]);
  return onDuty(orderChain(members), away, date);
}

async function tickProfile(profile: Profile, now: Date): Promise<number> {
  const today = istDate(now);
  const chain = await dutyChain(profile.id, today);
  if (!chain.length) return 0;
  // Anyone away today: what they still hold moves to their cover (handoffs set to start on a later day land here).
  const awayToday = await sql<{ member_id: string; cover_id: string | null; name: string }>`select a.member_id, a.cover_id, m.name
    from away a join members m on m.id = a.member_id
    where a.profile_id = ${profile.id} and a.starts_on <= ${today} and a.ends_on >= ${today}`;
  for (const a of awayToday) {
    const cover = chain.find((m) => m.id === a.cover_id);
    if (cover) await reassignTo(profile, chain, a.member_id, a.name, cover);
  }
  const first = chain[0];
  const helper = firstHelper(chain);
  let sent = 0;

  // Doses: upcoming reminders, then missed doses become owned alerts.
  const meds = await sql<Med>`select * from medications where profile_id = ${profile.id} and status = 'active'`;
  const medById = new Map(meds.map((m) => [m.id, m]));
  const logs = await sql<{ med_id: string; at: Date; status: string }>`select med_id, at, status from dose_logs
    where profile_id = ${profile.id} and at >= ${new Date(now.getTime() - 2 * 86_400_000)}`;
  const logged = new Map(logs.map((l) => [`${l.med_id}:${l.at.getTime()}`, l.status]));

  for (const slot of [...slotsForDay(meds, addDays(today, -1)), ...slotsForDay(meds, today)]) {
    const med = medById.get(slot.medId);
    if (!med || slot.at < med.created_at) continue;
    const key = slotKey(slot);
    const status = logged.get(key);
    const state = classifySlot(slot.at, now, status === "taken" || status === "skipped");

    // "due" too: if the timer ran late and skipped the 15-minute window, still remind once.
    if ((state === "upcoming" || state === "due") && (await once(`up:${key}`))) {
      const base = { m: first.id, p: profile.id, med: med.id, at: slot.at.getTime() };
      const ok = await sendMail(first.email, `Time for ${med.brand} at ${showTime(slot.at)}`, [
        `${medName(med)}${med.instructions ? `, ${med.instructions}` : ""}.`,
        "Tap once you've taken it, so nobody needs to worry.",
      ], [
        { label: "I took it", href: actionLink({ ...base, a: "taken" }) },
        { label: "I chose to skip", href: actionLink({ ...base, a: "skip" }) },
      ]);
      sent += ok ? 1 : 0;
    }

    if (state === "missed") {
      await sql`insert into dose_logs (med_id, profile_id, at, status) values (${med.id}, ${profile.id}, ${slot.at}, 'missed')
        on conflict do nothing`;
      if (now.getTime() - slot.at.getTime() < ALERT_LOOKBACK_MS) {
        sent += await raise(profile, chain, "dose", `dose:${key}`,
          `${profile.elder_name} hasn't marked ${med.brand} (${showTime(slot.at)})`,
          `The ${showTime(slot.at)} dose of ${medName(med)} is over 30 minutes late and nobody has marked it.`, 0,
          { dose: { medId: med.id, at: slot.at } });
      }
    }
  }

  // Refills: an owner for "who's buying more?"
  for (const med of meds) {
    if (med.pills_left == null || !med.times.length) continue;
    const daysLeft = med.pills_left / (med.pills_per_dose * med.times.length);
    if (daysLeft < REFILL_DAYS) {
      sent += await raise(profile, chain, "refill", `refill:${med.id}`, `${med.brand} is running out`,
        `Only ${med.pills_left} left, about ${Math.floor(daysLeft)} day(s). Someone needs to buy more before ${profile.elder_name} runs out.`, helper);
    }
  }

  // Appointments: reminders for everyone, and an owner for "who's taking them?"
  const appts = await sql<Appointment>`select * from appointments where profile_id = ${profile.id}
    and starts_at > ${now} and starts_at < ${new Date(now.getTime() + ESCORT_ASK_HOURS * 3_600_000)}`;
  for (const a of appts) {
    const where = `${showWhen(a.starts_at)}${a.location ? ` at ${a.location}` : ""}${a.purpose ? `, ${a.purpose}` : ""}.`;
    if (!a.escort_id) {
      sent += await raise(profile, chain, "escort", `escort:${a.id}`, `Who's taking ${profile.elder_name} to ${a.doctor}?`, where, helper);
    }
    const hours = (a.starts_at.getTime() - now.getTime()) / 3_600_000;
    const tag = hours <= 2 ? "appt2" : hours <= 24 ? "appt24" : null;
    if (tag && (await once(`${tag}:${a.id}`))) {
      const escort = chain.find((m) => m.id === a.escort_id);
      const results = await Promise.all(chain.map((m) => sendMail(m.email,
        `${visitHeading(a.starts_at, now)}: ${profile.elder_name} sees ${a.doctor}`,
        [where, escort ? `${escort.name} is taking them.` : "Nobody has said they're taking them yet."])));
      sent += results.filter(Boolean).length;
    }
  }

  // Escalation: an alert nobody answered moves to the next link every 15 minutes.
  const open = await sql<Alert>`select * from alerts where profile_id = ${profile.id} and status = 'open'`;
  for (const alert of open) {
    const next = nextLevel(alert.level, alert.last_notified_at, now, chain.length);
    if (next === null) continue;
    const owner = chain[next];
    const [moved] = await sql<Alert>`update alerts set level = ${next}, owner_id = ${owner.id}, last_notified_at = ${now}
      where id = ${alert.id} and level = ${alert.level} and status = 'open' returning *`;
    if (!moved) continue;
    await addTrail(profile.id, moved.id, null, `No answer from ${chain[alert.level]?.name ?? "the last person"}. Passed to ${owner.name}.`);
    if (await notifyOwner(profile, moved, owner, chain)) sent++;
  }
  return sent;
}

const TICK_EVERY_MS = 5 * 60_000;

/**
 * Backup for the GitHub timer (which can run late or pause): when someone opens the app,
 * run this circle's check, at most once per 5-minute window.
 */
export async function runTickIfDue(profileId: string, now: Date = new Date()): Promise<void> {
  if (await once(`tick:${profileId}:${Math.floor(now.getTime() / TICK_EVERY_MS)}`)) await runTick(now, profileId);
}

/** One pass of reminders, missed-dose alerts, refills, escorts and escalation. Safe to run concurrently. */
export async function runTick(now: Date = new Date(), profileId?: string): Promise<{ profiles: number; emails: number }> {
  const profiles = profileId
    ? await sql<Profile>`select id, code, elder_name from profiles where id = ${profileId}`
    : await sql<Profile>`select id, code, elder_name from profiles`;
  let emails = 0;
  for (const p of profiles) emails += await tickProfile(p, now);
  if (!profileId) {
    // Housekeeping on the full run: these tables only matter for a few days.
    await sql`delete from sent_keys where sent_at < now() - interval '3 days'`;
    await sql`delete from mail_quota where day < ${addDays(istDate(now), -7)}`;
  }
  return { profiles: profiles.length, emails };
}
