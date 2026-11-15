import { doseInstant, istDate } from "./time";

/** Heading for an appointment reminder email. */
export function visitHeading(startsAt: Date, now: Date): "In 2 hours" | "Later today" | "Tomorrow" {
  if (startsAt.getTime() - now.getTime() <= 2 * 3_600_000) return "In 2 hours";
  return istDate(startsAt) === istDate(now) ? "Later today" : "Tomorrow";
}

export const REMIND_BEFORE_MIN = 15;
export const GRACE_MIN = 30;

export interface Slot {
  medId: string;
  at: Date;
}

export interface SchedulableMed {
  id: string;
  times: string[];
  start_date: string;
  end_date: string | null;
}

export type SlotState = "future" | "upcoming" | "due" | "missed" | "done";

export function slotsForDay(meds: SchedulableMed[], date: string): Slot[] {
  return meds
    .filter((m) => m.start_date <= date && (!m.end_date || m.end_date >= date))
    .flatMap((m) => m.times.map((t) => ({ medId: m.id, at: doseInstant(date, t) })))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export const slotKey = (s: Slot): string => `${s.medId}:${s.at.getTime()}`;

/** Doses whose grace window has passed, and how many of those were taken. */
export function adherence(slots: Slot[], takenKeys: Set<string>, now: Date): { due: number; taken: number } {
  const past = slots.filter((s) => now.getTime() - s.at.getTime() > GRACE_MIN * 60_000);
  return { due: past.length, taken: past.filter((s) => takenKeys.has(slotKey(s))).length };
}

/** `logged` means someone marked the dose taken or skipped. */
export function classifySlot(at: Date, now: Date, logged: boolean): SlotState {
  if (logged) return "done";
  const minutes = (now.getTime() - at.getTime()) / 60_000;
  if (minutes < -REMIND_BEFORE_MIN) return "future";
  if (minutes < 0) return "upcoming";
  if (minutes <= GRACE_MIN) return "due";
  return "missed";
}
