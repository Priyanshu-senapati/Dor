import { describe, it, expect, beforeAll } from "vitest";
import { signToken, verifyToken } from "../lib/token";
import { hashPasscode, verifyPasscode } from "../lib/passcode";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret";
});

describe("email action tokens", () => {
  it("round-trips a payload", () => expect(verifyToken<{ a: string }>(signToken({ a: "ack" }, 10))?.a).toBe("ack"));
  it("rejects a tampered payload", () => {
    const [, sig] = signToken({ a: "ack" }, 10).split(".");
    const forged = Buffer.from(JSON.stringify({ a: "skip", exp: Date.now() + 1e6 })).toString("base64url");
    expect(verifyToken(`${forged}.${sig}`)).toBeNull();
  });
  it("rejects an expired token", () => expect(verifyToken(signToken({ a: "ack" }, -1))).toBeNull());
  it("rejects garbage", () => expect(verifyToken("nope")).toBeNull());
});

describe("passcodes", () => {
  it("verifies the right passcode", () => expect(verifyPasscode("2468", hashPasscode("2468"))).toBe(true));
  it("rejects a wrong passcode", () => expect(verifyPasscode("2469", hashPasscode("2468"))).toBe(false));
  it("salts each hash", () => expect(hashPasscode("2468")).not.toBe(hashPasscode("2468")));
});
