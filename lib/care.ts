import { sql } from "./db";
import { notifyHandled } from "./notify";
import { sendMail } from "./mail";
import { SKIP_REASONS } from "./symptoms";
import { istDate, showTime, showWhen } from "./time";
import type { Alert, Appointment, Med, Member, Profile } from "./types";

export const isUuid = (s: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function logEvent(profileId: string, memberId: string | null, kind: string, label: string): Promise<void> {
  await sql`insert into events (profile_id, member_id, kind, label) values (${profileId}, ${memberId}, ${kind}, ${label})`;
}

const medName = (m: Pick<Med, "brand" | "dose">) => `${m.brand}${m.dose ? ` ${m.dose}` : ""}`;

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
    const symptom = SKIP_REASONS.find((r) => r.label === reason)?.symptom;
    if (symptom) {
      await sql`insert into symptoms (profile_id, member_id, name, note) values (${profile.id}, ${by.id}, ${symptom}, ${`Gave it as the reason to skip ${med.brand}`})`;
    }
  }
  await sql`update alerts set status = 'resolved', resolution = ${label}
    where profile_id = ${profile.id} and ref_key = ${`dose:${med.id}:${atMs}`} and status <> 'resolved'`;
  return status === "taken" ? "Marked as taken. Thank you!" : "Noted. Your family will see your reason, not a red alarm.";
}

export async function claimEscort(profile: Profile, chain: Member[], apptId: string, by: Member): Promise<string> {
  if (!isUuid(apptId)) return "That appointment couldn't be found.";
  const [appt] = await sql<Appointment>`update appointments set escort_id = ${by.id}
    where id = ${apptId} and profile_id = ${profile.id} and escort_id is null returning *`;
  if (!appt) return "Someone is already taking them.";
  const label = `${by.name} will take ${profile.elder_name} to ${appt.doctor} (${showWhen(appt.starts_at)})`;
  await sql`update alerts set status = 'resolved', acked_by = ${by.id}, acked_at = now(), resolution = ${label}
    where profile_id = ${profile.id} and ref_key = ${`escort:${appt.id}`} and status <> 'resolved'`;
  await logEvent(profile.id, by.id, "escort", label);
  await Promise.all(
    chain.filter((m) => m.id !== by.id).map((m) => sendMail(m.email, label, ["No need to arrange anything else unless they ask for help."])),
  );
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
  await logEvent(profile.id, by.id, "ack", `${by.name} is handling: ${alert.title}`);
  await notifyHandled(alert, by, chain);
  return "Thanks! Everyone knows you're on it, and Dor has stopped passing it on.";
}

export async function resolveAlert(profile: Profile, alertId: string, by: Member, note: string): Promise<void> {
  if (!isUuid(alertId)) return;
  await sql`update alerts set status = 'resolved', resolution = ${note || `Done (${by.name})`}
    where id = ${alertId} and profile_id = ${profile.id} and status <> 'resolved'`;
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
