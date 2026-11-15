import { describe, it, expect } from "vitest";
import { flagSymptoms } from "../lib/trace";

const oct = (d: string) => new Date(`2026-10-${d}T10:00:00+05:30`);
const changes = [
  { at: oct("02"), label: "Started Amlong 5 mg" },
  { at: oct("12"), label: "Amlong 5 mg → 10 mg" },
];

describe("flagSymptoms", () => {
  it("flags a symptom first logged within 7 days after a change", () => {
    const flags = flagSymptoms(changes, [
      { at: oct("16"), name: "dizziness" },
      { at: oct("14"), name: "dizziness" },
    ]);
    expect(flags).toEqual([
      { symptom: "dizziness", firstAt: oct("14"), change: "Amlong 5 mg → 10 mg", daysAfter: 2, count: 2 },
    ]);
  });
  it("counts calendar days in IST, not 24-hour periods", () => {
    const flags = flagSymptoms(
      [{ at: new Date("2026-10-12T18:00:00+05:30"), label: "change" }],
      [{ at: new Date("2026-10-14T09:00:00+05:30"), name: "dizziness" }],
    );
    expect(flags[0].daysAfter).toBe(2);
  });
  it("does not flag a symptom that started more than 7 days after the last change", () =>
    expect(flagSymptoms(changes, [{ at: oct("21"), name: "swelling" }])).toEqual([]));
  it("does not flag a symptom that began before any change", () =>
    expect(flagSymptoms(changes, [{ at: new Date("2026-09-20T10:00:00+05:30"), name: "headache" }])).toEqual([]));
});
