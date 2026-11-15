import { sql } from "./db";
import { flagSymptoms, type Flag } from "./trace";
import type { EventRow, SymptomRow } from "./types";

export const CHANGE_KINDS = ["med_start", "med_change", "med_stop"];

/** Events, symptoms and the Trace flags linking them, for the Trace page and the Doctor Brief. */
export async function loadHistory(profileId: string): Promise<{ events: EventRow[]; symptoms: SymptomRow[]; flags: Flag[] }> {
  const [events, symptoms] = await Promise.all([
    sql<EventRow>`select id, member_id, kind, label, at from events where profile_id = ${profileId} order by at desc limit 300`,
    sql<SymptomRow>`select id, member_id, name, note, at from symptoms where profile_id = ${profileId} order by at desc limit 300`,
  ]);
  const changes = events.filter((e) => CHANGE_KINDS.includes(e.kind)).map((e) => ({ at: e.at, label: e.label }));
  return { events, symptoms, flags: flagSymptoms(changes, symptoms) };
}
