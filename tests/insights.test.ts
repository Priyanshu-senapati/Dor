import { describe, it, expect } from "vitest";
import { whyMissed, careLoad, loadWarning } from "../lib/insights";
import { findGaps } from "../lib/gaps";
import { onDuty } from "../lib/chain";
import { doseOutcome } from "../lib/outcomes";

describe("whyMissed", () => {
  it("groups skipped reasons and never-marked doses, largest first, ignoring taken doses", () => {
    const rows = whyMissed([
      { status: "taken", reason: "" },
      { status: "missed", reason: "" },
      { status: "missed", reason: "" },
      { status: "skipped", reason: "Ran out" },
      { status: "skipped", reason: "" },
    ]);
    expect(rows).toEqual([
      { reason: "Never marked", count: 2, pct: 50 },
      { reason: "Ran out", count: 1, pct: 25 },
      { reason: "Skipped, no reason given", count: 1, pct: 25 },
    ]);
  });
  it("is empty when nothing was missed", () => expect(whyMissed([{ status: "taken", reason: "" }])).toEqual([]));
});

describe("careLoad", () => {
  const rows = [
    { id: "r", name: "Riya", alerts: 14, visits: 2, refills: 2 },
    { id: "a", name: "Arjun", alerts: 4, visits: 0, refills: 1 },
    { id: "m", name: "Meera", alerts: 0, visits: 0, refills: 0 },
  ];
  it("totals each person's care events and their share, busiest first", () => {
    expect(careLoad(rows)).toEqual([
      { id: "r", name: "Riya", total: 18, pct: 78 },
      { id: "a", name: "Arjun", total: 5, pct: 22 },
      { id: "m", name: "Meera", total: 0, pct: 0 },
    ]);
  });
  it("warns when one person carries 60% or more", () =>
    expect(loadWarning(careLoad(rows))).toBe("Riya has handled 78% of care events in the last 30 days."));
  it("stays quiet when the load is shared", () =>
    expect(loadWarning(careLoad([{ id: "r", name: "Riya", alerts: 5, visits: 0, refills: 0 }, { id: "a", name: "Arjun", alerts: 5, visits: 0, refills: 0 }]))).toBeNull());
  it("stays quiet for a single helper or no events", () => {
    expect(loadWarning(careLoad([{ id: "r", name: "Riya", alerts: 5, visits: 0, refills: 0 }]))).toBeNull();
    expect(loadWarning(careLoad([{ id: "r", name: "Riya", alerts: 0, visits: 0, refills: 0 }, { id: "a", name: "Arjun", alerts: 0, visits: 0, refills: 0 }]))).toBeNull();
  });
});

describe("onDuty", () => {
  const chain = [{ id: "e" }, { id: "r" }, { id: "a" }];
  const away = [{ member_id: "r", starts_on: "2026-11-18", ends_on: "2026-11-22" }];
  it("drops a member while they are away", () => expect(onDuty(chain, away, "2026-11-20").map((m) => m.id)).toEqual(["e", "a"]));
  it("keeps them outside the dates", () => expect(onDuty(chain, away, "2026-11-23").map((m) => m.id)).toEqual(["e", "r", "a"]));
});

describe("findGaps", () => {
  const base = { now: new Date("2026-11-15T10:00:00+05:30"), elderName: "Kamala Devi", helpers: 2, visits: [], refills: [], pending: [] };
  it("flags a visit in the next 7 days with nobody taking them", () => {
    const gaps = findGaps({ ...base, visits: [{ id: "v", doctor: "Dr Rao", starts_at: new Date("2026-11-16T11:00:00+05:30"), escort_id: null }] });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ kind: "visit", ref: "v" });
  });
  it("flags a medicine running out within 7 days that nobody has claimed", () => {
    const gaps = findGaps({ ...base, refills: [{ id: "m", brand: "Thyronorm", daysLeft: 2, owned: false }, { id: "n", brand: "Shelcal", daysLeft: 2, owned: true }] });
    expect(gaps.map((g) => g.ref)).toEqual(["m"]);
  });
  it("flags a decision waiting on the elder for more than a day", () => {
    const gaps = findGaps({ ...base, pending: [{ id: "p", brand: "Amlong", created_at: new Date("2026-11-13T19:00:00+05:30") }] });
    expect(gaps[0]).toMatchObject({ kind: "decision", ref: "p" });
  });
  it("flags a chain with only one person after the elder", () =>
    expect(findGaps({ ...base, helpers: 1 }).map((g) => g.kind)).toEqual(["backup"]));
  it("is empty when every upcoming thing has an owner", () => expect(findGaps(base)).toEqual([]));
});

describe("doseOutcome", () => {
  it("maps 'ran out' to a skip with a reason and a refill task", () =>
    expect(doseOutcome("ran_out")).toMatchObject({ dose: "skipped", reason: "Ran out", refill: true }));
  it("maps 'couldn't reach' to passing the alert on", () => expect(doseOutcome("unreachable")).toMatchObject({ pass: true }));
  it("rejects unknown outcomes", () => expect(doseOutcome("nope")).toBeNull());
});
