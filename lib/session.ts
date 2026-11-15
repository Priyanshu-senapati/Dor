import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { signToken, verifyToken } from "./token";
import { orderChain } from "./chain";
import type { Member, Profile } from "./types";

const COOKIE = "dor";
const SESSION_DAYS = 30;

export async function setSession(profileId: string, memberId: string): Promise<void> {
  (await cookies()).set(COOKIE, signToken({ p: profileId, m: memberId }, SESSION_DAYS * 24 * 60), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 86_400,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export interface Circle {
  profile: Profile;
  member: Member;
  chain: Member[];
  elder: Member | undefined;
}

export async function loadCircle(profileId: string, memberId: string): Promise<Circle | null> {
  const [profile] = await sql<Profile>`select id, code, elder_name from profiles where id = ${profileId}`;
  if (!profile) return null;
  const chain = orderChain(await sql<Member>`select * from members where profile_id = ${profileId}`);
  const member = chain.find((m) => m.id === memberId);
  if (!member) return null;
  return { profile, member, chain, elder: chain.find((m) => m.role === "elder") };
}

/** The signed-in member and their care circle; sends anyone else back to the start page. */
export async function requireCircle(): Promise<Circle> {
  const token = (await cookies()).get(COOKIE)?.value;
  const session = token ? verifyToken<{ p: string; m: string; a?: string }>(token) : null;
  // Email action tokens share the signing key; one pasted in as a cookie must not become a session.
  const circle = session && !session.a ? await loadCircle(session.p, session.m) : null;
  if (!circle) redirect("/?error=" + encodeURIComponent("Please join your care circle first."));
  return circle;
}
