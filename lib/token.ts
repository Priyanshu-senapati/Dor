import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest();

/** Signed, expiring token for session cookies and one-click email actions. */
export function signToken(payload: Record<string, unknown>, ttlMin: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMin * 60_000 })).toString("base64url");
  return `${body}.${sign(body).toString("base64url")}`;
}

export function verifyToken<T>(token: string): (T & { exp: number }) | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const given = Buffer.from(sig, "base64url");
  const expected = sign(body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof payload.exp === "number" && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
