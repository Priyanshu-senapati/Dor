import { DAY_MS } from "./time";

export const TRACE_WINDOW_DAYS = 7;

export interface Change {
  at: Date;
  label: string;
}

export interface SymptomEntry {
  at: Date;
  name: string;
}

export interface Flag {
  symptom: string;
  firstAt: Date;
  change: string;
  daysAfter: number;
  count: number;
}

/** For each symptom, link its first appearance to the most recent medicine change within the window. */
export function flagSymptoms(changes: Change[], symptoms: SymptomEntry[], windowDays = TRACE_WINDOW_DAYS): Flag[] {
  const byName = new Map<string, Date[]>();
  for (const s of symptoms) byName.set(s.name, [...(byName.get(s.name) ?? []), s.at]);

  return [...byName].flatMap(([symptom, dates]) => {
    const firstAt = new Date(Math.min(...dates.map((d) => d.getTime())));
    const before = changes.filter((c) => c.at <= firstAt).sort((a, b) => b.at.getTime() - a.at.getTime())[0];
    if (!before) return [];
    const daysAfter = Math.floor((firstAt.getTime() - before.at.getTime()) / DAY_MS);
    return daysAfter <= windowDays ? [{ symptom, firstAt, change: before.label, daysAfter, count: dates.length }] : [];
  });
}
