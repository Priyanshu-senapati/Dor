import { describe, it, expect } from "vitest";
import { resolveSalts, findDuplicates } from "../lib/salts";

describe("resolveSalts", () => {
  it("resolves a combination brand typed with strength and odd case", () =>
    expect(resolveSalts("TELMA-AM 40")).toEqual(["telmisartan", "amlodipine"]));
  it("resolves a brand with the strength stuck to the name", () =>
    expect(resolveSalts("dolo650")).toEqual(["paracetamol"]));
  it("ignores tablet prefixes and mg units", () => expect(resolveSalts("Tab. Amlong 5mg")).toEqual(["amlodipine"]));
  it("matches the brand when extra words follow it", () =>
    expect(resolveSalts("Glycomet GP 2 Forte")).toEqual(["metformin", "glimepiride"]));
  it("accepts a generic name typed directly", () => expect(resolveSalts("Amlodipine")).toEqual(["amlodipine"]));
  it("does not match a short brand hidden inside a longer word", () => expect(resolveSalts("Panadolx")).toEqual([]));
  it("returns nothing for an unknown brand", () => expect(resolveSalts("Zzzyx 10")).toEqual([]));
});

describe("findDuplicates", () => {
  const med = (id: string, brand: string, salts: string[], by: string) => ({
    id, brand, salts, prescribed_by: by, prescribed_on: "2026-10-14",
  });
  it("flags the same salt across two prescriptions", () => {
    const dups = findDuplicates([
      med("1", "Telma-AM 40", ["telmisartan", "amlodipine"], "Dr Sharma"),
      med("2", "Amlong 5", ["amlodipine"], "Dr Rao"),
      med("3", "Thyronorm 50", ["levothyroxine"], "Dr Rao"),
    ]);
    expect(dups).toHaveLength(1);
    expect(dups[0].salt).toBe("amlodipine");
    expect(dups[0].meds.map((m) => m.id)).toEqual(["1", "2"]);
  });
  it("does not flag medicines with different salts", () =>
    expect(findDuplicates([med("1", "Amlong", ["amlodipine"], "A"), med("2", "Telma", ["telmisartan"], "B")])).toEqual([]));
});
