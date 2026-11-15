export const ESCALATE_EVERY_MIN = 15;

interface ChainMember {
  role: string;
  chain_order: number;
}

/** The care chain: the elder is always the first link, then everyone else in their chosen order. */
export function orderChain<M extends ChainMember>(members: M[]): M[] {
  const rank = (m: M) => (m.role === "elder" ? 0 : 1);
  return [...members].sort((a, b) => rank(a) - rank(b) || a.chain_order - b.chain_order);
}

/** The chain as it stands on `date` (YYYY-MM-DD): anyone away is skipped while their cover holds the string. */
export function onDuty<M extends { id: string }>(
  chain: M[],
  away: { member_id: string; starts_on: string; ends_on: string }[],
  date: string,
): M[] {
  return chain.filter((m) => !away.some((a) => a.member_id === m.id && a.starts_on <= date && a.ends_on >= date));
}

/** Errands (refills, escorts) start with the first non-elder link, or the elder if they're alone. */
export function firstHelper(chain: { role: string }[]): number {
  return Math.max(0, chain.findIndex((m) => m.role !== "elder"));
}

/** The next link to hand an unanswered alert to, or null if it should stay where it is. */
export function nextLevel(level: number, lastNotifiedAt: Date, now: Date, chainLength: number): number | null {
  if (level >= chainLength - 1) return null;
  if (now.getTime() - lastNotifiedAt.getTime() < ESCALATE_EVERY_MIN * 60_000) return null;
  return level + 1;
}
