import Link from "next/link";
import { sql } from "@/lib/db";
import { requireCircle } from "@/lib/session";
import { adherence, classifySlot, slotKey, slotsForDay, type Slot } from "@/lib/schedule";
import { findDuplicates } from "@/lib/salts";
import { addDays, istDate, showTime, showWhen } from "@/lib/time";
import { checkNow, decideMed, claimEscortAction, claimRefillAction } from "../actions";
import { findGaps, GAP_WINDOW_DAYS } from "@/lib/gaps";
import { AlertCard } from "@/components/AlertCard";
import { DoseActions } from "@/components/DoseActions";
import { DuplicateList } from "@/components/DuplicateList";
import { Card, Flash, Pill, primary, quiet, secondary, type FlashParams } from "@/components/ui";
import { AlertIcon, ArrowRightIcon, CheckIcon, RefreshIcon } from "@/components/icons";
import { Submit } from "@/components/Submit";
import type { Alert, Appointment, DoseLog, Med } from "@/lib/types";

const STATE = {
  future: { tone: "plain", text: "Later" },
  upcoming: { tone: "info", text: "Soon" },
  due: { tone: "warn", text: "Due now" },
  missed: { tone: "alarm", text: "Not marked" },
} as const;

function greeting(now: Date): string {
  const h = Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" }).format(now));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function Today({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const sp = await searchParams;
  const { profile, member, chain, duty, elder } = await requireCircle();
  const now = new Date();
  const today = istDate(now);
  const [meds, logs, alerts, visits] = await Promise.all([
    sql<Med>`select * from medications where profile_id = ${profile.id} and status in ('active', 'pending') order by created_at`,
    sql<DoseLog>`select med_id, at, status, reason, marked_by from dose_logs
      where profile_id = ${profile.id} and at >= ${new Date(now.getTime() - 8 * 86_400_000)}`,
    sql<Alert>`select * from alerts where profile_id = ${profile.id} and status <> 'resolved' order by created_at desc`,
    sql<Appointment>`select * from appointments where profile_id = ${profile.id} and starts_at > ${now}
      and starts_at < ${new Date(now.getTime() + GAP_WINDOW_DAYS * 86_400_000)} order by starts_at`,
  ]);
  const nextAppt = visits[0] ?? (await sql<Appointment>`select * from appointments where profile_id = ${profile.id}
    and starts_at > ${now} order by starts_at limit 1`)[0];
  const trailRows = alerts.length
    ? await sql<{ alert_id: string; label: string; at: Date }>`select alert_id, label, at from events
        where alert_id = any(${alerts.map((a) => a.id)}::uuid[]) order by at`
    : [];
  const trailOf = (id: string) => trailRows.filter((t) => t.alert_id === id);

  const active = meds.filter((m) => m.status === "active");
  const pending = meds.filter((m) => m.status === "pending");
  const medById = new Map(meds.map((m) => [m.id, m]));
  const counted = (s: Slot) => s.at >= (medById.get(s.medId)?.created_at ?? now);
  const logByKey = new Map(logs.map((l) => [`${l.med_id}:${l.at.getTime()}`, l]));
  const todays = slotsForDay(active, today).filter(counted);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).flatMap((d) => slotsForDay(active, d)).filter(counted);
  const takenKeys = new Set(logs.filter((l) => l.status === "taken").map((l) => `${l.med_id}:${l.at.getTime()}`));
  const adh = adherence(week, takenKeys, now);
  const pct = adh.due ? Math.round((adh.taken / adh.due) * 100) : null;
  const dups = findDuplicates(meds);
  const nameOf = (id: string | null) => chain.find((m) => m.id === id)?.name ?? "someone";
  const isElder = member.role === "elder";
  const first = profile.elder_name.split(" ")[0];
  const gaps = findGaps({
    now,
    elderName: profile.elder_name,
    helpers: duty.filter((m) => m.role !== "elder").length,
    visits,
    refills: active
      .filter((m) => m.pills_left != null && m.times.length)
      .map((m) => ({
        id: m.id,
        brand: m.brand,
        daysLeft: Math.floor((m.pills_left ?? 0) / (m.pills_per_dose * m.times.length)),
        owned: alerts.some((a) => a.ref_key === `refill:${m.id}` && a.status === "acked"),
      })),
    pending: pending.map((m) => ({ id: m.id, brand: m.brand, created_at: m.created_at })),
  });

  return (
    <div className="space-y-6">
      <Flash ok={sp.ok} error={sp.error} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted">{greeting(now)}, {member.name}</p>
          <h1 className="font-display text-4xl">Today for {profile.elder_name}</h1>
        </div>
        <form action={checkNow} className="no-print">
          <Submit className={quiet} pending="Checking…">
            <RefreshIcon className="h-4 w-4" /> Run the reminder check now
          </Submit>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title={alerts.length ? "Needs someone" : "Nothing needs anyone right now"}>
            {alerts.length ? (
              <ul className="space-y-3">
                {alerts.map((a) => (
                  <AlertCard
                    key={a.id}
                    alert={a}
                    chain={chain}
                    duty={duty}
                    me={member}
                    elderName={profile.elder_name}
                    now={now}
                    trail={trailOf(a.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-muted">
                Every alert has one owner here. When a dose is missed, Dor asks {elder?.name ?? "the elder"} first, then passes it
                down the chain until someone says “I’m on it”.
              </p>
            )}
          </Card>

          <Card title={gaps.length ? "Care gaps: nobody owns these yet" : "No care gaps this week"}>
            {gaps.length ? (
              <ul className="space-y-3">
                {gaps.map((g, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper p-4">
                    <p className="max-w-prose font-bold">{g.text}</p>
                    {g.kind === "visit" && g.ref && (
                      <form action={claimEscortAction}>
                        <input type="hidden" name="id" value={g.ref} />
                        <input type="hidden" name="from" value="/p" />
                        <Submit className={secondary}>I’ll take {first}</Submit>
                      </form>
                    )}
                    {g.kind === "refill" && g.ref && (
                      <form action={claimRefillAction}>
                        <input type="hidden" name="id" value={g.ref} />
                        <input type="hidden" name="from" value="/p" />
                        <Submit className={secondary}>I’ll buy it</Submit>
                      </form>
                    )}
                    {g.kind === "decision" && (
                      <Link href="/p/meds" className={secondary}>{isElder ? "Decide now" : `Remind ${first}`}</Link>
                    )}
                    {g.kind === "backup" && (
                      <Link href="/p/circle" className={secondary}>Invite a backup</Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">
                Every visit in the next 7 days has someone taking {first}, every medicine running low has a buyer, and the
                chain has a backup.
              </p>
            )}
          </Card>

          {pending.length > 0 && (
            <Card title={isElder ? "Your family suggested a change" : `Waiting for ${elder?.name ?? "the elder"} to approve`}>
              <ul className="space-y-3">
                {pending.map((m) => {
                  const clash = dups.find((d) => d.meds.some((x) => x.id === m.id));
                  return (
                    <li key={m.id} className="rounded-xl bg-paper p-4">
                      <p className="text-lg font-bold">{m.brand} {m.dose}</p>
                      <p className="text-muted">
                        Suggested by {nameOf(m.created_by)}{m.prescribed_by ? `, prescribed by ${m.prescribed_by}` : ""}
                      </p>
                      {clash && (
                        <p className="mt-2 flex items-start gap-2 font-bold text-alarm">
                          <AlertIcon className="mt-0.5 h-5 w-5" /> Contains {clash.salt}, already in {clash.meds.filter((x) => x.id !== m.id).map((x) => x.brand).join(", ")}.
                        </p>
                      )}
                      {isElder && (
                        <div className="mt-3 flex gap-2">
                          <form action={decideMed}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="decision" value="approve" />
                            <input type="hidden" name="from" value="/p" />
                            <Submit className={primary}>Yes, add it</Submit>
                          </form>
                          <form action={decideMed}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="decision" value="decline" />
                            <input type="hidden" name="from" value="/p" />
                            <Submit className={secondary}>No</Submit>
                          </form>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card title="Today’s medicines">
            {todays.length ? (
              <ul className="divide-y divide-line">
                {todays.map((s) => {
                  const med = medById.get(s.medId);
                  if (!med) return null;
                  const log = logByKey.get(slotKey(s));
                  const done = log && log.status !== "missed";
                  const state = classifySlot(s.at, now, Boolean(done));
                  return (
                    <li key={slotKey(s)} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-4">
                        <span className="w-20 font-display text-xl tabular-nums">{showTime(s.at)}</span>
                        <div>
                          <p className="font-bold">{med.brand} {med.dose}</p>
                          <p className="text-sm text-muted">{med.instructions || med.salts.join(" + ")}</p>
                        </div>
                      </div>
                      {state === "done" && log ? (
                        <p className={`font-bold ${log.status === "taken" ? "text-leaf" : "text-warn"}`}>
                          {log.status === "taken" ? (
                            <span className="inline-flex items-center gap-1.5"><CheckIcon /> Taken</span>
                          ) : (
                            `Chose to skip${log.reason ? `: ${log.reason}` : ""}`
                          )}
                          <span className="block text-sm font-normal text-muted">marked by {nameOf(log.marked_by)}</span>
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={STATE[state as keyof typeof STATE].tone}>{STATE[state as keyof typeof STATE].text}</Pill>
                          {state !== "future" && <DoseActions medId={med.id} at={s.at.getTime()} from="/p" />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted">
                No medicines scheduled today. <Link className="font-bold text-sky underline" href="/p/meds">Add one</Link>.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={pct === null ? "No doses yet this week" : `${pct}% taken this week`}>
            <div className="h-3 overflow-hidden rounded-full bg-line" role="img" aria-label={`${adh.taken} of ${adh.due} doses taken`}>
              <div className="h-full rounded-full bg-leaf" style={{ width: `${pct ?? 0}%` }} />
            </div>
            <p className="mt-2 text-muted">{adh.taken} of {adh.due} doses marked taken.</p>
          </Card>

          {dups.length > 0 && (
            <Card title="Same medicine, twice" className="border-alarm/30">
              <DuplicateList dups={dups} />
            </Card>
          )}

          <Card title={nextAppt ? `Next visit: ${nextAppt.doctor}` : "No visits booked"}>
            {nextAppt ? (
              <>
                <p className="text-muted">{showWhen(nextAppt.starts_at)}{nextAppt.location ? ` · ${nextAppt.location}` : ""}</p>
                {nextAppt.escort_id ? (
                  <p className="mt-2 flex items-center gap-2 font-bold text-leaf">
                    <CheckIcon /> {nameOf(nextAppt.escort_id)} is taking {profile.elder_name}
                  </p>
                ) : (
                  <form action={claimEscortAction} className="mt-3">
                    <input type="hidden" name="id" value={nextAppt.id} />
                    <input type="hidden" name="from" value="/p" />
                    <Submit className={primary}>I’ll take {profile.elder_name}</Submit>
                  </form>
                )}
                <Link href={`/p/brief/${nextAppt.id}`} className={`${quiet} mt-2 -ml-3`}>
                  Open the Doctor Brief <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <Link href="/p/appointments" className={`${quiet} -ml-3`}>
                Add an appointment <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
