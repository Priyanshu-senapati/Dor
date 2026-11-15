/**
 * Google Calendar "add event" link (Calendar's event-template URL). No OAuth and no stored tokens:
 * nothing reaches Google until the person chooses to save the event to their own calendar.
 */
export function googleCalendarLink(e: { title: string; start: Date; minutes: number; location?: string; details?: string }): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(e.start.getTime() + e.minutes * 60_000);
  const params = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${stamp(e.start)}/${stamp(end)}`, ctz: "Asia/Kolkata" });
  if (e.location) params.set("location", e.location);
  if (e.details) params.set("details", e.details);
  return `https://calendar.google.com/calendar/render?${params}`;
}

export const VISIT_MINUTES = 60;

/** A doctor visit as a calendar event that names who is responsible. Deliberately carries no medical detail. */
export function visitCalendarLink(
  visit: { doctor: string; location: string; starts_at: Date },
  elderFirst: string,
  escort: string | null,
  dorUrl: string,
): string {
  return googleCalendarLink({
    title: `${elderFirst}’s visit to ${visit.doctor}${escort ? `: ${escort} taking ${elderFirst}` : ""}`,
    start: visit.starts_at,
    minutes: VISIT_MINUTES,
    location: visit.location || undefined,
    details: `${escort ? `${escort} is responsible for this visit in Dor.` : "Nobody has said they’re taking them yet: claim it in Dor."} Questions for the doctor and the Doctor Brief: ${dorUrl}/p/appointments`,
  });
}
