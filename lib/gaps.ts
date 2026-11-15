import { showDay, showWhen, DAY_MS } from "./time";

export const GAP_WINDOW_DAYS = 7;

export interface Gap {
  kind: "visit" | "refill" | "decision" | "backup";
  ref?: string;
  text: string;
}

export interface GapInput {
  now: Date;
  elderName: string;
  /** People in the chain after the elder who are on duty now. */
  helpers: number;
  visits: { id: string; doctor: string; starts_at: Date; escort_id: string | null }[];
  refills: { id: string; brand: string; daysLeft: number; owned: boolean }[];
  pending: { id: string; brand: string; created_at: Date }[];
}

/** Things coming up that nobody is responsible for yet: failures to prevent, not alerts to react to. */
export function findGaps(i: GapInput): Gap[] {
  const gaps: Gap[] = [];
  const soon = (d: Date) => d > i.now && d.getTime() - i.now.getTime() <= GAP_WINDOW_DAYS * DAY_MS;

  for (const v of i.visits) {
    if (!v.escort_id && soon(v.starts_at)) {
      gaps.push({ kind: "visit", ref: v.id, text: `${showWhen(v.starts_at)}: nobody is taking ${i.elderName} to ${v.doctor}.` });
    }
  }
  for (const r of i.refills) {
    if (!r.owned && r.daysLeft <= GAP_WINDOW_DAYS) {
      gaps.push({ kind: "refill", ref: r.id, text: `${r.brand} runs out in about ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}, and nobody has said they’ll buy it.` });
    }
  }
  for (const p of i.pending) {
    if (i.now.getTime() - p.created_at.getTime() > DAY_MS) {
      gaps.push({ kind: "decision", ref: p.id, text: `${p.brand} has been waiting for ${i.elderName}’s decision since ${showDay(p.created_at)}.` });
    }
  }
  if (i.helpers < 2) {
    gaps.push({
      kind: "backup",
      text: i.helpers === 0
        ? `Nobody but ${i.elderName} is in the chain, so missed doses have nowhere to go. Invite family.`
        : `Only one person can be reached after ${i.elderName}. Invite a backup, so alerts still find someone when they’re busy.`,
    });
  }
  return gaps;
}
