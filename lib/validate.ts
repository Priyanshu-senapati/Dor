// Checks for user-controlled input, applied on the server before anything touches the database.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_EMAIL = 120;

export const isEmail = (s: string): boolean => s.length <= MAX_EMAIL && EMAIL_RE.test(s);

/** A real YYYY-MM-DD calendar date (rejects 2026-02-31). */
export function isDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const isTime = (s: string): boolean => TIME_RE.test(s);

/** Valid HH:MM dose times, de-duplicated and in order. */
export const cleanTimes = (values: string[]): string[] => [...new Set(values.filter(isTime))].sort();

/** Ingredients typed by hand ("Telmisartan + Amlodipine"), lower-cased. */
export const parseSalts = (typed: string): string[] =>
  typed
    .toLowerCase()
    .split(/\s*[,+]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Only ever send people back to a page inside the app: no open redirects. */
export const safeReturnPath = (from: string, fallback: string): string => (/^\/p(\/[a-z]+)?$/.test(from) ? from : fallback);

/** "dor-demo", " demo ", "DOR 4F7K" → "DOR-DEMO", "DOR-DEMO", "DOR-4F7K". */
export function normalizeCode(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `DOR-${s.replace(/^DOR/, "")}`;
}
