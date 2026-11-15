import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { signToken, verifyToken } from "./token";
import { onDuty, orderChain } from "./chain";
import { istDate } from "./time";
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

export interface AwayRow {
  id: string;
  member_id: string;
  cover_id: string | null;
  starts_on: string;
  ends_on: string;
}

export interface Circle {
  profile: Profile;
  member: Member;
  /** Everyone, in chain order. */
  chain: Member[];
  /** The chain today: anyone away is skipped. Alert levels index into this. */
  duty: Member[];
  away: AwayRow[];
  elder: Member | undefined;
}

export async function loadCircle(profileId: string, memberId: string): Promise<Circle | null> {
  const [[profile], members, away] = await Promise.all([
    sql<Profile>`select id, code, elder_name from profiles where id = ${profileId}`,
    sql<Member>`select * from members where profile_id = ${profileId}`,
    sql<AwayRow>`select id, member_id, cover_id, starts_on, ends_on from away
      where profile_id = ${profileId} and ends_on >= ${istDate(new Date())} order by starts_on`,
  ]);
  if (!profile) return null;
  const chain = orderChain(members);
  const member = chain.find((m) => m.id === memberId);
  if (!member) return null;
  const duty = onDuty(chain, away, istDate(new Date()));
  return { profile, member, chain, duty, away, elder: chain.find((m) => m.role === "elder") };
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
