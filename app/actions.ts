"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { hashPasscode, verifyPasscode } from "@/lib/passcode";
import { clearSession, loadCircle, requireCircle, setSession } from "@/lib/session";
import { resolveSalts } from "@/lib/salts";
import { istDate, showWhen } from "@/lib/time";
import { verifyToken } from "@/lib/token";
import { appUrl, sendMail } from "@/lib/mail";
import { runTick } from "@/lib/tick";
import {
  ackAlert, activateMed, claimEscort, claimRefill, endAway, isUuid, logEvent, medName, recordDose, reportOutcome, resolveAlert, setAway,
} from "@/lib/care";
import type { EmailAction, Med, Role } from "@/lib/types";
import { cleanTimes, isDate, isEmail, isTime, normalizeCode, parseSalts, safeReturnPath } from "@/lib/validate";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_MEMBERS = 12;
const MAX_DEMO_MEMBERS = 40;
const MAX_TIMES_PER_MED = 6;
const MAX_MEDS = 30;
const MAX_UPCOMING_APPTS = 20;
const LOCK_AFTER = 5;
const DEMO_CODE = "DOR-DEMO";
const NO_MATCH = "That code and passcode don't match, or the circle is paused for 10 minutes after too many tries.";

const text = (fd: FormData, key: string, max = 120): string => String(fd.get(key) ?? "").trim().slice(0, max);
const isRole = (r: string): r is Role => r === "elder" || r === "caretaker" || r === "family";

function back(path: string, message: string, kind: "error" | "ok" = "error"): never {
  const [base, hash] = path.split("#");
  redirect(`${base}${base.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}${hash ? `#${hash}` : ""}`);
}

/** Only allow redirects back into the app. */
const returnTo = (fd: FormData, fallback = "/p") => safeReturnPath(text(fd, "from", 80), fallback);

const refresh = () => revalidatePath("/p", "layout");

// ── Access ──────────────────────────────────────────────────────────────────

export async function createProfile(fd: FormData): Promise<void> {
  const elderName = text(fd, "elderName", 60);
  const role = text(fd, "role");
  const name = role === "elder" ? elderName : text(fd, "name", 60);
  const email = text(fd, "email", 120).toLowerCase();
  const elderEmail = text(fd, "elderEmail", 120).toLowerCase();
  const passcode = text(fd, "passcode", 32);
  if (!elderName || !name) back("/#start", "Please fill in the names.");
  if (!isRole(role)) back("/#start", "Please choose who you are.");
  if (!isEmail(email)) back("/#start", "Please enter a valid email. Dor sends reminders there.");
  if (elderEmail && !isEmail(elderEmail)) back("/#start", "That elder email doesn't look right.");
  if (passcode.length < 4) back("/#start", "The passcode needs at least 4 characters.");

  const code = `DOR-${Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("")}`;
  const [profile] = await sql<{ id: string }>`insert into profiles (code, elder_name, passcode_hash)
    values (${code}, ${elderName}, ${hashPasscode(passcode)}) returning id`;
  const [me] = await sql<{ id: string }>`insert into members (profile_id, name, email, role, chain_order)
    values (${profile.id}, ${name}, ${email}, ${role}, ${role === "elder" ? 0 : 1}) returning id`;
  if (role !== "elder" && elderEmail && elderEmail !== email) {
    await sql`insert into members (profile_id, name, email, role, chain_order) values (${profile.id}, ${elderName}, ${elderEmail}, 'elder', 0)`;
  }
  await logEvent(profile.id, me.id, "circle", `${name} started ${elderName}'s care circle`);
  await setSession(profile.id, me.id);
  back("/p/circle", `Your circle is ready. Share the code ${code} and the passcode with family.`, "ok");
}

export async function joinProfile(fd: FormData): Promise<void> {
  const code = normalizeCode(text(fd, "code", 20));
  const passcode = text(fd, "passcode", 32);
  const name = text(fd, "name", 60);
  const email = text(fd, "email", 120).toLowerCase();
  const role = text(fd, "role");
  if (!name || !isEmail(email)) back("/#join", "Please enter your name and a valid email.");
  if (!isRole(role)) back("/#join", "Please choose who you are.");

  const demo = code === DEMO_CODE;
  type JoinRow = { id: string; passcode_hash: string; elder_name: string };
  // Count the attempt before the slow hash check, so parallel guesses can't slip past the lockout.
  // The 5th try locks the circle for 10 minutes; the demo passcode is public, so it never locks.
  const [profile] = demo
    ? await sql<JoinRow>`select id, passcode_hash, elder_name from profiles where code = ${code}`
    : await sql<JoinRow>`update profiles set
          failed_attempts = case when failed_attempts >= ${LOCK_AFTER} then 1 else failed_attempts + 1 end,
          locked_until = case when failed_attempts + 1 = ${LOCK_AFTER} then now() + interval '10 minutes' else locked_until end
        where code = ${code} and coalesce(locked_until, 'epoch'::timestamptz) < now()
        returning id, passcode_hash, elder_name`;
  if (!profile || !verifyPasscode(passcode, profile.passcode_hash)) back("/#join", NO_MATCH);
  if (!demo) await sql`update profiles set failed_attempts = 0, locked_until = null where id = ${profile.id}`;

  const [existing] = await sql<{ id: string }>`select id from members where profile_id = ${profile.id} and email = ${email}`;
  let memberId = existing?.id;
  if (!memberId) {
    const [stats] = await sql<{ count: number; max: number; elders: number }>`select count(*)::int as count,
      coalesce(max(chain_order), 0)::int as max, (count(*) filter (where role = 'elder'))::int as elders
      from members where profile_id = ${profile.id}`;
    if (stats.count >= (demo ? MAX_DEMO_MEMBERS : MAX_MEMBERS)) back("/#join", "This circle is full.");
    if (role === "elder" && stats.elders > 0) back("/#join", `${profile.elder_name} is already in this circle. Join as family or caretaker.`);
    const [m] = await sql<{ id: string }>`insert into members (profile_id, name, email, role, chain_order)
      values (${profile.id}, ${name}, ${email}, ${role}, ${role === "elder" ? 0 : stats.max + 1}) returning id`;
    memberId = m.id;
    await logEvent(profile.id, memberId, "circle", `${name} joined the circle as ${role}`);
  } else if (!demo) {
    // Signing in as an existing email is allowed by the shared-passcode model, so make it visible.
    await logEvent(profile.id, memberId, "circle", "Signed in on a new device");
    await sendMail(email, `New sign-in to ${profile.elder_name}'s circle on Dor`, [
      "Someone just signed in to Dor with your email and the circle passcode.",
      "If this wasn't you, tell your family so they can keep an eye on changes.",
    ]);
  }
  await setSession(profile.id, memberId);
  redirect("/p");
}

/** One-click entry for judges: only ever signs into the seeded demo circle. */
export async function enterDemo(fd: FormData): Promise<void> {
  const elder = text(fd, "role") === "elder";
  const [m] = await sql<{ id: string; profile_id: string }>`select m.id, m.profile_id from members m
    join profiles p on p.id = m.profile_id
    where p.code = 'DOR-DEMO' and m.role = ${elder ? "elder" : "caretaker"} order by m.chain_order limit 1`;
  if (!m) back("/#demo", "The demo circle isn't set up yet.");
  await setSession(m.profile_id, m.id);
  redirect(elder ? "/p/elder" : "/p");
}

export async function leaveCircle(): Promise<void> {
  await clearSession();
  redirect("/");
}

// ── Medicines ──────────────────────────────────────────────────────────────

export async function saveMed(fd: FormData): Promise<void> {
  const { profile, member, elder } = await requireCircle();
  const brand = text(fd, "brand", 80);
  if (!brand) back("/p/meds", "Enter the medicine's name as written on the strip.");
  const times = cleanTimes(fd.getAll("time").map(String));
  if (!times.length) back("/p/meds", "Pick at least one time of day.");
  if (times.length > MAX_TIMES_PER_MED) back("/p/meds", `At most ${MAX_TIMES_PER_MED} times a day per medicine.`);
  const [{ n }] = await sql<{ n: number }>`select count(*)::int as n from medications
    where profile_id = ${profile.id} and status in ('active', 'pending')`;
  if (n >= MAX_MEDS) back("/p/meds", `A circle can track up to ${MAX_MEDS} medicines. Stop one first.`);

  const known = resolveSalts(brand);
  const salts = known.length ? known : parseSalts(text(fd, "salt", 80));
  const replaces = text(fd, "replaces", 40);
  if (replaces) {
    const [old] = isUuid(replaces)
      ? await sql`select id from medications where id = ${replaces} and profile_id = ${profile.id} and status = 'active'`
      : [];
    if (!old) back("/p/meds", "That medicine has already changed. Refresh and try again.");
  }
  const date = (k: string) => {
    const v = text(fd, k, 10);
    return isDate(v) ? v : null;
  };
  const int = (k: string, min: number, max: number) => {
    const raw = text(fd, k, 6);
    const v = Number(raw);
    return raw !== "" && Number.isInteger(v) && v >= min && v <= max ? v : null;
  };

  const needsApproval = Boolean(elder) && member.role !== "elder";
  const [med] = await sql<Med>`insert into medications (profile_id, brand, salts, dose, times, start_date, end_date,
      instructions, pills_left, pills_per_dose, prescribed_by, prescribed_on, status, created_by, replaces_id)
    values (${profile.id}, ${brand}, ${salts}, ${text(fd, "dose", 40)}, ${times}, ${date("startDate") ?? istDate(new Date())},
      ${date("endDate")}, ${text(fd, "instructions", 120)}, ${int("pillsLeft", 0, 2000)}, ${int("pillsPerDose", 1, 10) ?? 1},
      ${text(fd, "prescribedBy", 80)}, ${date("prescribedOn")}, ${needsApproval ? "pending" : "active"}, ${member.id},
      ${replaces || null})
    returning *`;

  if (needsApproval && elder) {
    await logEvent(profile.id, member.id, "proposal", `${member.name} proposed ${replaces ? "changing to" : "adding"} ${medName(med)}`);
    await sendMail(elder.email, `${member.name} suggested a change to your medicines`, [
      `${member.name} wants to ${replaces ? "change one of your medicines to" : "add"} ${medName(med)}${med.prescribed_by ? ` (prescribed by ${med.prescribed_by})` : ""}.`,
      "Nothing changes in your schedule until you say yes.",
    ], [{ label: "Review it", href: `${appUrl()}/p/meds` }]);
    refresh();
    back("/p/meds", `Sent to ${elder.name} to approve. Nothing changes until they say yes.`, "ok");
  }
  const added = await activateMed(profile, med, member);
  refresh();
  if (!added) back("/p/meds", "That medicine changed in the meantime. Refresh and try again.");
  back("/p/meds", `${medName(med)} is in the schedule.`, "ok");
}

export async function decideMed(fd: FormData): Promise<void> {
  const { profile, member, elder } = await requireCircle();
  if (elder && member.role !== "elder") back("/p/meds", `Only ${elder.name} can approve changes to their own medicines.`);
  const id = text(fd, "id", 40);
  const [med] = isUuid(id)
    ? await sql<Med>`select * from medications where id = ${id} and profile_id = ${profile.id} and status = 'pending'`
    : [];
  if (!med) back("/p/meds", "That suggestion was already handled.");
  if (text(fd, "decision") === "approve") {
    const added = await activateMed(profile, med, member);
    refresh();
    if (!added) back(returnTo(fd, "/p/meds"), "That medicine was already changed by another suggestion, so this one was set aside.");
    back(returnTo(fd, "/p/meds"), `Approved. ${medName(med)} is in the schedule.`, "ok");
  }
  await sql`update medications set status = 'declined' where id = ${med.id}`;
  await logEvent(profile.id, member.id, "decline", `${member.name} declined ${medName(med)}`);
  refresh();
  back(returnTo(fd, "/p/meds"), "Declined. Your schedule stays as it was.", "ok");
}

export async function stopMed(fd: FormData): Promise<void> {
  const { profile, member, elder } = await requireCircle();
  if (elder && member.role !== "elder") back("/p/meds", `Only ${elder.name} can stop their own medicines.`);
  const id = text(fd, "id", 40);
  const [med] = isUuid(id)
    ? await sql<Med>`update medications set status = 'stopped', end_date = ${istDate(new Date())}
        where id = ${id} and profile_id = ${profile.id} and status = 'active' returning *`
    : [];
  if (med) await logEvent(profile.id, member.id, "med_stop", `Stopped ${medName(med)}`);
  refresh();
  back("/p/meds", med ? `${medName(med)} stopped.` : "Already stopped.", "ok");
}

export async function refillMed(fd: FormData): Promise<void> {
  const { profile, member } = await requireCircle();
  const id = text(fd, "id", 40);
  const count = Number(text(fd, "count", 5));
  if (!isUuid(id) || !Number.isInteger(count) || count < 1 || count > 1000) back(returnTo(fd, "/p/meds"), "Enter how many tablets you bought.");
  const [med] = await sql<Med>`update medications set pills_left = coalesce(pills_left, 0) + ${count}
    where id = ${id} and profile_id = ${profile.id} returning *`;
  if (!med) back("/p/meds", "Medicine not found.");
  // Free the alert key so a future shortage can raise a fresh alert.
  await sql`update alerts set status = 'resolved', resolution = ${`${member.name} refilled ${med.brand} (+${count})`},
      ref_key = ref_key || ':' || id
    where profile_id = ${profile.id} and ref_key = ${`refill:${med.id}`}`;
  await logEvent(profile.id, member.id, "refill", `${member.name} refilled ${med.brand} (+${count})`);
  refresh();
  back(returnTo(fd, "/p/meds"), `${med.brand}: ${med.pills_left} tablets now.`, "ok");
}

// ── Doses & alerts ─────────────────────────────────────────────────────────

export async function markDose(fd: FormData): Promise<void> {
  const { profile, member } = await requireCircle();
  const status = text(fd, "status") === "taken" ? "taken" : "skipped";
  const msg = await recordDose(profile, member, text(fd, "med", 40), Number(text(fd, "at", 20)), status, text(fd, "reason", 120));
  refresh();
  back(returnTo(fd), msg, "ok");
}

export async function reportOutcomeAction(fd: FormData): Promise<void> {
  const { profile, duty, member } = await requireCircle();
  const msg = await reportOutcome(profile, duty, text(fd, "id", 40), text(fd, "outcome", 20), member);
  refresh();
  back(returnTo(fd), msg, "ok");
}

export async function claimRefillAction(fd: FormData): Promise<void> {
  const { profile, duty, member } = await requireCircle();
  const msg = await claimRefill(profile, duty, text(fd, "id", 40), member);
  refresh();
  back(returnTo(fd), msg, "ok");
}

const MAX_AWAY_DAYS = 60;

export async function setAwayAction(fd: FormData): Promise<void> {
  const { profile, chain, member } = await requireCircle();
  const starts = text(fd, "starts", 10);
  const ends = text(fd, "ends", 10);
  const today = istDate(new Date());
  if (!isDate(starts) || !isDate(ends) || starts < today || ends < starts) back("/p/circle", "Pick dates from today onwards, with the end on or after the start.");
  if ((Date.parse(ends) - Date.parse(starts)) / 86_400_000 > MAX_AWAY_DAYS) back("/p/circle", `Cover can be set for up to ${MAX_AWAY_DAYS} days at a time.`);
  if (member.role === "elder") back("/p/circle", "The elder is always first in the chain.");
  const msg = await setAway(profile, chain, member, text(fd, "cover", 40), starts, ends);
  refresh();
  back("/p/circle", msg, msg.startsWith("Done") ? "ok" : "error");
}

export async function endAwayAction(fd: FormData): Promise<void> {
  const { profile, member } = await requireCircle();
  const msg = await endAway(profile, text(fd, "id", 40), member);
  refresh();
  back("/p/circle", msg, "ok");
}

export async function ackAlertAction(fd: FormData): Promise<void> {
  const { profile, chain, member } = await requireCircle();
  const msg = await ackAlert(profile, chain, text(fd, "id", 40), member);
  refresh();
  back(returnTo(fd), msg, "ok");
}

export async function resolveAlertAction(fd: FormData): Promise<void> {
  const { profile, member } = await requireCircle();
  await resolveAlert(profile, text(fd, "id", 40), member, text(fd, "note", 160));
  refresh();
  back(returnTo(fd), "Marked done.", "ok");
}

export async function checkNow(): Promise<void> {
  const { profile } = await requireCircle();
  const { emails } = await runTick(new Date(), profile.id);
  refresh();
  back("/p", `Checked just now. ${emails} email${emails === 1 ? "" : "s"} sent.`, "ok");
}

/** POST from a one-click email link (the GET only shows a confirm page, so mail scanners can't trigger it). */
export async function respondFromEmail(fd: FormData): Promise<void> {
  const token = text(fd, "token", 2000);
  const action = verifyToken<EmailAction>(token);
  if (!action) redirect(`/done?error=${encodeURIComponent("This link has expired. Open Dor to respond.")}`);
  const circle = await loadCircle(action.p, action.m);
  if (!circle) redirect(`/done?error=${encodeURIComponent("You're no longer in this care circle.")}`);
  let msg = "Nothing to do.";
  const outcome = text(fd, "outcome", 20);
  if (action.a === "ack" && action.id && outcome) {
    msg = await reportOutcome(circle.profile, circle.duty, action.id, outcome, circle.member);
  } else if (action.a === "ack" && action.id) {
    await ackAlert(circle.profile, circle.chain, action.id, circle.member);
    // Straight on to "What happened?", so the email itself carries the whole workflow.
    redirect(`/act/${token}`);
  } else if ((action.a === "taken" || action.a === "skip") && action.med && action.at) {
    msg = await recordDose(circle.profile, circle.member, action.med, action.at, action.a === "taken" ? "taken" : "skipped", text(fd, "reason", 120));
  }
  redirect(`/done?ok=${encodeURIComponent(msg)}`);
}

// ── Appointments ───────────────────────────────────────────────────────────

export async function addAppointment(fd: FormData): Promise<void> {
  const { profile, member } = await requireCircle();
  const doctor = text(fd, "doctor", 80);
  const date = text(fd, "date", 10);
  const time = text(fd, "time", 5);
  if (!doctor || !isDate(date) || !isTime(time)) back("/p/appointments", "Enter the doctor, date and time.");
  const startsAt = new Date(`${date}T${time}:00+05:30`);
  const [{ n }] = await sql<{ n: number }>`select count(*)::int as n from appointments
    where profile_id = ${profile.id} and starts_at > now()`;
  if (n >= MAX_UPCOMING_APPTS) back("/p/appointments", `Up to ${MAX_UPCOMING_APPTS} upcoming visits can be tracked.`);
  await sql`insert into appointments (profile_id, doctor, specialty, location, starts_at, purpose, questions)
    values (${profile.id}, ${doctor}, ${text(fd, "specialty", 60)}, ${text(fd, "location", 120)}, ${startsAt},
      ${text(fd, "purpose", 160)}, ${text(fd, "questions", 1000)})`;
  await logEvent(profile.id, member.id, "appointment", `${member.name} booked ${doctor} for ${showWhen(startsAt)}`);
  refresh();
  back("/p/appointments", "Appointment added. Dor will remind everyone and ask who's taking them.", "ok");
}

export async function claimEscortAction(fd: FormData): Promise<void> {
  const { profile, chain, member } = await requireCircle();
  const msg = await claimEscort(profile, chain, text(fd, "id", 40), member);
  refresh();
  back(returnTo(fd, "/p/appointments"), msg, "ok");
}

export async function addQuestion(fd: FormData): Promise<void> {
  const { profile, member } = await requireCircle();
  const id = text(fd, "id", 40);
  const q = text(fd, "question", 300);
  if (!isUuid(id) || !q) back("/p/appointments", "Type a question first.");
  await sql`update appointments set questions = trim(both from questions || E'\n' || ${`${member.name}: ${q}`})
    where id = ${id} and profile_id = ${profile.id}`;
  refresh();
  back("/p/appointments", "Added to the Doctor Brief.", "ok");
}

// ── Trace & circle ─────────────────────────────────────────────────────────

export async function logSymptom(fd: FormData): Promise<void> {
  const { profile, member } = await requireCircle();
  const name = (text(fd, "name", 40) === "other" ? text(fd, "other", 40) : text(fd, "name", 40)).toLowerCase();
  if (!name) back("/p/trace", "Pick what they're feeling.");
  await sql`insert into symptoms (profile_id, member_id, name, note) values (${profile.id}, ${member.id}, ${name}, ${text(fd, "note", 200)})`;
  refresh();
  back("/p/trace", "Logged. Dor will line it up against medicine changes.", "ok");
}

export async function moveMember(fd: FormData): Promise<void> {
  const { chain } = await requireCircle();
  const links = chain.filter((m) => m.role !== "elder");
  const i = links.findIndex((m) => m.id === text(fd, "id", 40));
  const j = text(fd, "dir") === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= links.length) back("/p/circle", "Can't move further.");
  const reordered = links.map((m, k) => (k === i ? links[j] : k === j ? links[i] : m));
  for (const [k, m] of reordered.entries()) await sql`update members set chain_order = ${k + 1} where id = ${m.id}`;
  refresh();
  back("/p/circle", "Order updated. Alerts now pass along in this order.", "ok");
}
