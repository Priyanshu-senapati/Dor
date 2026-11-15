import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(passcode, salt, 32).toString("hex")}`;
}

export function verifyPasscode(passcode: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const given = scryptSync(passcode, salt, 32);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
