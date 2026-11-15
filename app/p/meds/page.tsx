import { sql } from "@/lib/db";
import { requireCircle } from "@/lib/session";
import { adherence, slotsForDay } from "@/lib/schedule";
import { findDuplicates } from "@/lib/salts";
import { addDays, doseInstant, istDate, showTime } from "@/lib/time";
import { decideMed, refillMed, stopMed } from "../../actions";
import { MedForm } from "@/components/MedForm";
import { DuplicateList } from "@/components/DuplicateList";
import { Card, Flash, Pill, field, primary, quiet, secondary, type FlashParams } from "@/components/ui";
import { Submit } from "@/components/Submit";
import type { DoseLog, Med } from "@/lib/types";

export default async function Meds({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const sp = await searchParams;
  const { profile, member, elder, chain } = await requireCircle();
  const now = new Date();
  const today = istDate(now);
  const [meds, logs] = await Promise.all([
    sql<Med>`select * from medications where profile_id = ${profile.id} order by created_at desc`,
    sql<DoseLog>`select med_id, at, status, reason, marked_by from dose_logs
      where profile_id = ${profile.id} and status = 'taken' and at >= ${new Date(now.getTime() - 8 * 86_400_000)}`,
  ]);
  const active = meds.filter((m) => m.status === "active");
  const pending = meds.filter((m) => m.status === "pending");
  const past = meds.filter((m) => m.status === "stopped" || m.status === "declined");
  const current = [...active, ...pending];
  const dups = findDuplicates(current);
  const taken = new Set(logs.map((l) => `${l.med_id}:${l.at.getTime()}`));
  const canDecide = !elder || member.role === "elder";
  const needsApproval = Boolean(elder) && member.role !== "elder";
  const nameOf = (id: string | null) => chain.find((m) => m.id === id)?.name ?? "someone";
  const weekFor = (m: Med) => {
    const slots = Array.from({ length: 7 }, (_, i) => addDays(today, -i))
      .flatMap((d) => slotsForDay([m], d))
      .filter((s) => s.at >= m.created_at);
    const a = adherence(slots, taken, now);
    return a.due ? Math.round((a.taken / a.due) * 100) : null;
  };

  return (
    <div className="space-y-6">
      <Flash ok={sp.ok} error={sp.error} />
      <h1 className="font-display text-4xl">{profile.elder_name}’s medicines</h1>

      {dups.length > 0 && (
        <Card title="The same ingredient is prescribed twice" className="border-alarm/30">
          <p className="mb-3 text-muted">
            Different brands, different doctors, same salt. Families are often the only ones who see the whole list.
          </p>
          <DuplicateList dups={dups} />
        </Card>
      )}

      {pending.length > 0 && (
        <Card title={canDecide ? "Suggested changes" : `Waiting for ${elder?.name}`}>
          <ul className="space-y-3">
            {pending.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper p-4">
                <div>
                  <p className="text-lg font-bold">{m.brand} {m.dose}</p>
                  <p className="text-sm text-muted">
                    {m.replaces_id ? "Change suggested" : "Suggested"} by {nameOf(m.created_by)}
                    {m.prescribed_by ? ` · ${m.prescribed_by}` : ""} · contains {m.salts.join(" + ") || "unknown"}
                  </p>
                </div>
                {canDecide && (
                  <div className="flex gap-2">
                    <form action={decideMed}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <Submit className={primary}>Approve</Submit>
                    </form>
                    <form action={decideMed}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="decision" value="decline" />
                      <Submit className={secondary}>Decline</Submit>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title={active.length ? `${active.length} medicines in the schedule` : "No medicines yet"}>
          <ul className="space-y-4">
            {active.map((m) => {
              const pct = weekFor(m);
              const perDay = m.pills_per_dose * m.times.length;
              const daysLeft = m.pills_left != null && perDay ? Math.floor(m.pills_left / perDay) : null;
              return (
                <li key={m.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-2xl">{m.brand}</p>
                      <p className="text-muted">
                        {[m.dose, m.times.map((t) => showTime(doseInstant(today, t))).join(", "), m.instructions].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {pct !== null && <Pill tone={pct >= 80 ? "ok" : pct >= 50 ? "warn" : "alarm"}>{pct}% this week</Pill>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.salts.length ? m.salts.map((s) => <Pill key={s} tone="info">{s}</Pill>) : <Pill tone="warn">ingredient unknown</Pill>}
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {m.prescribed_by ? `Prescribed by ${m.prescribed_by}` : "Prescriber not recorded"}
                    {m.prescribed_on ? ` on ${m.prescribed_on}` : ""} · since {m.start_date}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {daysLeft !== null && (
                      <p className={`font-bold ${daysLeft < 3 ? "text-alarm" : ""}`}>
                        {m.pills_left} tablets left (~{daysLeft} days)
                      </p>
                    )}
                    <form action={refillMed} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <label className="sr-only" htmlFor={`refill-${m.id}`}>Tablets bought</label>
                      <input id={`refill-${m.id}`} name="count" type="number" min={1} max={1000} placeholder="+30" className={`${field} w-24 py-1.5`} />
                      <Submit className={quiet}>Refilled</Submit>
                    </form>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <details className="w-full">
                      <summary className={`${quiet} -ml-3 cursor-pointer list-none`}>Change dose or timing</summary>
                      <div className="mt-3 rounded-xl bg-paper p-4">
                        <MedForm others={current} initial={m} submitLabel={needsApproval ? "Suggest this change" : "Save change"} needsApproval={needsApproval} elderName={profile.elder_name} />
                      </div>
                    </details>
                    {canDecide && (
                      <form action={stopMed}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="text-sm font-bold text-alarm underline-offset-4 hover:underline">Stop this medicine</button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card title="Add a medicine">
            <MedForm others={current} submitLabel={needsApproval ? `Suggest to ${elder?.name}` : "Add to schedule"} needsApproval={needsApproval} elderName={profile.elder_name} />
          </Card>
          {past.length > 0 && (
            <Card title="Stopped and declined">
              <ul className="space-y-1 text-muted">
                {past.map((m) => (
                  <li key={m.id}>
                    {m.brand} {m.dose} · {m.status}
                    {m.end_date ? ` ${m.end_date}` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
