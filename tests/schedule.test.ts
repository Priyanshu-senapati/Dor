import { describe, it, expect } from "vitest";
import { slotsForDay, classifySlot } from "../lib/schedule";
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
  const med = { id: "m1", times: ["20:00", "08:00"], startDate: "2026-11-10", endDate: "2026-11-20" };
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
