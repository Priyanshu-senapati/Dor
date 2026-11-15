import { doseInstant } from "./time";

export const REMIND_BEFORE_MIN = 15;
export const GRACE_MIN = 30;

export interface Slot {
  medId: string;
  at: Date;
}

export interface SchedulableMed {
  id: string;
  times: string[];
  startDate: string;
  endDate: string | null;
}

export type SlotState = "future" | "upcoming" | "due" | "missed" | "done";

export function slotsForDay(meds: SchedulableMed[], date: string): Slot[] {
  return meds
    .filter((m) => m.startDate <= date && (!m.endDate || m.endDate >= date))
    .flatMap((m) => m.times.map((t) => ({ medId: m.id, at: doseInstant(date, t) })))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
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
