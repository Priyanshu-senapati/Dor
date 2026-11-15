import { appUrl, sendMail } from "./mail";
import { firstHelper } from "./chain";
import { signToken } from "./token";
import type { Alert, EmailAction, Member, Profile } from "./types";

const LINK_TTL_MIN = 24 * 60;

export const actionLink = (action: EmailAction): string => `${appUrl()}/act/${signToken({ ...action }, LINK_TTL_MIN)}`;

/** Parses "dose:<medId>:<epochMs>". */
export function doseRef(refKey: string): { med: string; at: number } | null {
  const [kind, med, at] = refKey.split(":");
  return kind === "dose" && med && at ? { med, at: Number(at) } : null;
}

/** Tell the current owner of an alert that it is theirs now. */
export async function notifyOwner(profile: Profile, alert: Alert, owner: Member, chain: Member[], note?: string): Promise<boolean> {
  const base = { m: owner.id, p: profile.id };
  const dose = doseRef(alert.ref_key);
  const open = { label: "Open Dor", href: `${appUrl()}/p` };

  if (dose && owner.role === "elder") {
    return sendMail(owner.email, `Did you take it? ${alert.title.replace(/^.*hasn't marked /, "")}`, [alert.body, "Tap one — your family will see your answer."], [
      { label: "I took it", href: actionLink({ ...base, a: "taken", med: dose.med, at: dose.at }) },
      { label: "I chose to skip", href: actionLink({ ...base, a: "skip", med: dose.med, at: dose.at }) },
    ]);
  }

  // Only name the people this alert has actually been with (errands skip the elder).
  const before = chain.slice(alert.kind === "dose" ? 0 : firstHelper(chain), alert.level).map((m) => m.name);
  const lines = note ? [note, alert.body] : [alert.body];
  if (before.length && !note) lines.push(`${before.join(" and ")} ${before.length > 1 ? "haven't" : "hasn't"} responded, so this is with you now.`);
  lines.push("Tap below so the rest of the family knows you've got it. If nobody does within 15 minutes, Dor passes it on.");
  const ack = alert.kind === "escort" ? `I'll take ${profile.elder_name}` : "I'm on it";
  return sendMail(owner.email, `You're up: ${alert.title}`, lines, [{ label: ack, href: actionLink({ ...base, a: "ack", id: alert.id }) }, open]);
}

/** Tell everyone else that someone has taken the alert, so nobody doubles up or assumes. */
export async function notifyHandled(alert: Alert, by: Member, chain: Member[]): Promise<void> {
  await Promise.all(
    chain
      .filter((m) => m.id !== by.id)
      .map((m) => sendMail(m.email, `${by.name} is handling it: ${alert.title}`, [`${by.name} said "I'm on it". No need to act unless they ask for help.`])),
  );
}
