export interface MissRow {
  reason: string;
  count: number;
  pct: number;
}

/** Why doses weren't taken: skip reasons in the elder's words, plus doses nobody marked. */
export function whyMissed(logs: { status: string; reason: string }[]): MissRow[] {
  const counts = new Map<string, number>();
  for (const l of logs) {
    if (l.status === "taken") continue;
    const key = l.status === "missed" ? "Never marked" : l.reason || "Skipped, no reason given";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts]
    .map(([reason, count]) => ({ reason, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export interface LoadInput {
  id: string;
  name: string;
  alerts: number;
  visits: number;
  refills: number;
}

export interface Load {
  id: string;
  name: string;
  total: number;
  pct: number;
}

/** Each helper's share of care events (alerts claimed, visits taken, refills bought), busiest first. */
export function careLoad(rows: LoadInput[]): Load[] {
  const totals = rows.map((r) => ({ id: r.id, name: r.name, total: r.alerts + r.visits + r.refills }));
  const sum = totals.reduce((a, t) => a + t.total, 0);
  return totals.map((t) => ({ ...t, pct: sum ? Math.round((t.total / sum) * 100) : 0 })).sort((a, b) => b.total - a.total);
}

export const OVERLOAD_PCT = 60;

/** A plain sentence when one person is quietly becoming the full-time caregiver. */
export function loadWarning(load: Load[]): string | null {
  const top = load[0];
  if (load.length < 2 || !top || top.total === 0 || top.pct < OVERLOAD_PCT) return null;
  return `${top.name} has handled ${top.pct}% of care events in the last 30 days.`;
}
