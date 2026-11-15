export const ESCALATE_EVERY_MIN = 15;

interface ChainMember {
  role: string;
  chainOrder: number;
}

/** The care chain: the elder is always the first link, then everyone else in their chosen order. */
export function orderChain<M extends ChainMember>(members: M[]): M[] {
  const rank = (m: M) => (m.role === "elder" ? 0 : 1);
  return [...members].sort((a, b) => rank(a) - rank(b) || a.chainOrder - b.chainOrder);
}

/** The next link to hand an unanswered alert to, or null if it should stay where it is. */
export function nextLevel(level: number, lastNotifiedAt: Date, now: Date, chainLength: number): number | null {
  if (level >= chainLength - 1) return null;
  if (now.getTime() - lastNotifiedAt.getTime() < ESCALATE_EVERY_MIN * 60_000) return null;
  return level + 1;
}
