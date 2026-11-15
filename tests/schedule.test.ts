import { describe, it, expect } from "vitest";
import { slotsForDay, classifySlot, adherence, slotKey, visitHeading } from "../lib/schedule";

describe("visitHeading", () => {
  const now = new Date("2026-11-15T10:00:00+05:30");
  it("says in 2 hours when it is that close", () =>
    expect(visitHeading(new Date("2026-11-15T11:30:00+05:30"), now)).toBe("In 2 hours"));
  it("says later today for a visit this evening", () =>
    expect(visitHeading(new Date("2026-11-15T18:00:00+05:30"), now)).toBe("Later today"));
  it("says tomorrow for a visit on the next IST date", () =>
    expect(visitHeading(new Date("2026-11-16T09:00:00+05:30"), now)).toBe("Tomorrow"));
});
import { istDate, doseInstant } from "../lib/time";

describe("time", () => {
  it("converts a UTC instant to the IST calendar date", () => {
    expect(istDate(new Date("2026-11-15T20:00:00Z"))).toBe("2026-11-16");
  });
  it("builds a dose instant in IST", () => {
    expect(doseInstant("2026-11-15", "08:00").toISOString()).toBe("2026-11-15T02:30:00.000Z");
  });
});

describe("slotsForDay", () => {
  const med = { id: "m1", times: ["20:00", "08:00"], start_date: "2026-11-10", end_date: "2026-11-20" };
  it("returns one slot per time, sorted, while the course is active", () => {
    const slots = slotsForDay([med], "2026-11-15");
    expect(slots.map((s) => s.at.toISOString())).toEqual([
      "2026-11-15T02:30:00.000Z",
      "2026-11-15T14:30:00.000Z",
    ]);
    expect(slots[0].medId).toBe("m1");
  });
  it("returns nothing outside the course dates", () => {
    expect(slotsForDay([med], "2026-11-21")).toEqual([]);
    expect(slotsForDay([med], "2026-11-09")).toEqual([]);
  });
});

describe("classifySlot", () => {
  const at = new Date("2026-11-15T02:30:00Z");
  const min = (m: number) => new Date(at.getTime() + m * 60_000);
  it("is future more than 15 minutes before", () => expect(classifySlot(at, min(-16), false)).toBe("future"));
  it("is upcoming within 15 minutes before", () => expect(classifySlot(at, min(-10), false)).toBe("upcoming"));
  it("is due until 30 minutes after the dose time", () => expect(classifySlot(at, min(30), false)).toBe("due"));
  it("is missed after the 30 minute grace", () => expect(classifySlot(at, min(31), false)).toBe("missed"));
  it("is done once logged, even after it was missed", () => expect(classifySlot(at, min(90), true)).toBe("done"));
});

describe("adherence", () => {
  it("counts only doses past their grace window, and how many were taken", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const slots = [
      { medId: "a", at: new Date("2026-11-15T02:30:00Z") },
      { medId: "b", at: new Date("2026-11-15T03:30:00Z") },
      { medId: "a", at: new Date("2026-11-15T11:45:00Z") },
    ];
    expect(adherence(slots, new Set([slotKey(slots[0])]), now)).toEqual({ due: 2, taken: 1 });
  });
});
