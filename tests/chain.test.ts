import { describe, it, expect } from "vitest";
import { orderChain, nextLevel } from "../lib/chain";

describe("orderChain", () => {
  it("puts the elder first, then members by chain order", () => {
    const members = [
      { id: "f", role: "family", chain_order: 2 },
      { id: "c", role: "caretaker", chain_order: 1 },
      { id: "e", role: "elder", chain_order: 9 },
    ];
    expect(orderChain(members).map((m) => m.id)).toEqual(["e", "c", "f"]);
  });
});

describe("nextLevel", () => {
  const t0 = new Date("2026-11-15T03:00:00Z");
  const after = (m: number) => new Date(t0.getTime() + m * 60_000);
  it("waits until 15 minutes have passed", () => expect(nextLevel(0, t0, after(14), 3)).toBeNull());
  it("moves to the next link after 15 minutes", () => expect(nextLevel(0, t0, after(15), 3)).toBe(1));
  it("stops at the last link", () => expect(nextLevel(2, t0, after(60), 3)).toBeNull());
  it("never escalates a chain with only one person", () => expect(nextLevel(0, t0, after(60), 1)).toBeNull());
});
