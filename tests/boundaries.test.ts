import { describe, it, expect } from "vitest";
import { cleanTimes, isDate, isEmail, normalizeCode, parseSalts, safeReturnPath } from "../lib/validate";
import { googleCalendarLink } from "../lib/gcal";
import { chooseFlashModel, handoffFallback, handoffPrompt } from "../lib/gemini";

describe("chooseFlashModel", () => {
  it("picks a text Flash model that supports generateContent", () => {
    expect(
      chooseFlashModel([
        { name: "models/gemini-3-pro", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3-flash-image", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3-flash", supportedGenerationMethods: ["generateContent", "countTokens"] },
        { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
      ]),
    ).toBe("gemini-3-flash");
  });
  it("skips moving aliases and previews", () =>
    expect(
      chooseFlashModel([
        { name: "models/gemini-flash-latest", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3-flash-preview", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3.1-flash-lite", supportedGenerationMethods: ["generateContent"] },
      ]),
    ).toBe("gemini-3.1-flash-lite"));
  it("returns null when nothing fits", () => expect(chooseFlashModel([{ name: "models/embed", supportedGenerationMethods: [] }])).toBeNull());
});

describe("input checks at the server boundary", () => {
  it("only redirects back inside the app", () => {
    expect(safeReturnPath("/p/meds", "/p")).toBe("/p/meds");
    expect(safeReturnPath("/p", "/p/meds")).toBe("/p");
    for (const evil of ["//evil.example", "https://evil.example", "/p/../admin", "/p/meds?x=1", "/pwned", "", "javascript:alert(1)"]) {
      expect(safeReturnPath(evil, "/p")).toBe("/p");
    }
  });
  it("normalises circle codes however they are typed", () => {
    expect(normalizeCode("dor-demo")).toBe("DOR-DEMO");
    expect(normalizeCode(" demo ")).toBe("DOR-DEMO");
    expect(normalizeCode("DOR 4F7K")).toBe("DOR-4F7K");
  });
  it("accepts real calendar dates only", () => {
    expect(isDate("2026-11-16")).toBe(true);
    expect(isDate("2026-02-31")).toBe(false);
    expect(isDate("16/11/2026")).toBe(false);
  });
  it("accepts plausible emails only", () => {
    expect(isEmail("riya@example.com")).toBe(true);
    expect(isEmail("riya@example")).toBe(false);
    expect(isEmail(`${"a".repeat(130)}@example.com`)).toBe(false);
  });
  it("keeps only valid, unique, sorted dose times", () =>
    expect(cleanTimes(["21:00", "08:00", "08:00", "25:00", "8am", ""])).toEqual(["08:00", "21:00"]));
  it("splits typed ingredients on commas and plus signs", () =>
    expect(parseSalts("Telmisartan + Amlodipine, ")).toEqual(["telmisartan", "amlodipine"]));
});

describe("googleCalendarLink", () => {
  const link = googleCalendarLink({
    title: "Kamala's visit to Dr Rao: Arjun taking her",
    start: new Date("2026-11-16T11:00:00+05:30"),
    minutes: 60,
    location: "Heart Care Clinic",
    details: "Owner in Dor: Arjun",
  });
  const url = new URL(link);
  it("builds a Google Calendar event template", () => {
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
  });
  it("carries the owner in the title and the right UTC times", () => {
    expect(url.searchParams.get("text")).toContain("Arjun");
    expect(url.searchParams.get("dates")).toBe("20261116T053000Z/20261116T063000Z");
    expect(url.searchParams.get("location")).toBe("Heart Care Clinic");
  });
});

describe("handoff briefing", () => {
  const input = {
    elderFirst: "Kamala",
    from: "Riya",
    to: "Arjun",
    range: "Sun, 15 Nov to Tue, 17 Nov",
    items: ["Telma-AM has run out"],
    meds: ["Telma-AM 40/5 mg at 8:00 am, after breakfast"],
    recent: ["Skipped Telma-AM: Felt dizzy"],
  };
  it("tells the model to restate facts and never give medical advice", () => {
    const p = handoffPrompt(input);
    expect(p).toMatch(/do not give medical advice/i);
    expect(p).toMatch(/do not diagnose/i);
    expect(p).toContain("Telma-AM has run out");
  });
  it("falls back to a plain, deterministic briefing", () => {
    const text = handoffFallback(input);
    expect(text).toContain("Arjun");
    expect(text).toContain("Telma-AM has run out");
    expect(text).toContain("Telma-AM 40/5 mg at 8:00 am");
  });
});
