import { sql } from "./db";
import { notifyOwner } from "./notify";
import type { Alert, Member, Profile } from "./types";

/** One line in an alert's trail (raised → passed on → claimed → outcome → resolved). */
export async function addTrail(profileId: string, alertId: string, memberId: string | null, label: string): Promise<void> {
  await sql`insert into events (profile_id, member_id, kind, label, alert_id) values (${profileId}, ${memberId}, 'trail', ${label}, ${alertId})`;
}

/**
 * Create an alert owned by chain[level] unless one with this key already exists.
 * For doses, the insert re-checks the log: someone may have tapped "Taken" a moment ago.
 * Returns how many emails went out (0 or 1).
 */
export async function raise(
  profile: Profile,
  chain: Member[],
  kind: Alert["kind"],
  refKey: string,
  title: string,
  body: string,
  level: number,
  opts: { dose?: { medId: string; at: Date }; notify?: boolean } = {},
): Promise<number> {
  const lvl = Math.max(0, Math.min(level, chain.length - 1));
  const owner = chain[lvl];
  if (!owner) return 0;
  const { dose, notify = true } = opts;
  const [alert] = dose
    ? await sql<Alert>`insert into alerts (profile_id, kind, ref_key, title, body, level, owner_id)
        select ${profile.id}, ${kind}, ${refKey}, ${title}, ${body}, ${lvl}, ${owner.id}
        where not exists (select 1 from dose_logs where med_id = ${dose.medId} and at = ${dose.at} and status in ('taken', 'skipped'))
        on conflict (profile_id, ref_key) do nothing returning *`
    : await sql<Alert>`insert into alerts (profile_id, kind, ref_key, title, body, level, owner_id)
        values (${profile.id}, ${kind}, ${refKey}, ${title}, ${body}, ${lvl}, ${owner.id})
        on conflict (profile_id, ref_key) do nothing returning *`;
  if (!alert) return 0;
  await addTrail(profile.id, alert.id, null, owner.role === "elder" ? `Raised. Asked ${owner.name} first.` : `Raised. With ${owner.name}.`);
  return notify && (await notifyOwner(profile, alert, owner, chain)) ? 1 : 0;
}
