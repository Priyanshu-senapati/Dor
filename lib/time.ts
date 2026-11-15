// shortcut: every profile runs on IST (UTC+05:30, no DST); add a per-profile timezone if users live outside India.
const IST_OFFSET_MS = 330 * 60_000;
export const DAY_MS = 86_400_000;

/** Calendar date (YYYY-MM-DD) of an instant, in IST. */
export function istDate(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant a dose at local time `hhmm` on IST date `date` happens. */
export function doseInstant(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00+05:30`);
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...opts });
const timeFmt = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
const dayFmt = fmt({ weekday: "short", day: "numeric", month: "short" });

export const showTime = (d: Date): string => timeFmt.format(d);
export const showDay = (d: Date): string => dayFmt.format(d);
export const showWhen = (d: Date): string => `${dayFmt.format(d)}, ${timeFmt.format(d)}`;
