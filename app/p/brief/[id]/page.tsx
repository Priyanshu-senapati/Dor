import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireCircle } from "@/lib/session";
import { isUuid } from "@/lib/care";
import { loadHistory } from "@/lib/history";
import { adherence, slotsForDay } from "@/lib/schedule";
import { findDuplicates } from "@/lib/salts";
import { addDays, istDate, showDay, showTime, showWhen } from "@/lib/time";
import { PrintButton } from "@/components/PrintButton";
import type { Appointment, DoseLog, Med } from "@/lib/types";

const DAYS = 30;

/** One printable page the family hands the doctor: what she takes, how it's going, what changed. */
export default async function DoctorBrief({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, chain } = await requireCircle();
  if (!isUuid(id)) notFound();
  const now = new Date();
  const [[appt], meds, logs, history] = await Promise.all([
    sql<Appointment>`select * from appointments where id = ${id} and profile_id = ${profile.id}`,
    sql<Med>`select * from medications where profile_id = ${profile.id} and status = 'active' order by brand`,
    sql<DoseLog>`select med_id, at, status, reason, marked_by from dose_logs
      where profile_id = ${profile.id} and at >= ${new Date(now.getTime() - DAYS * 86_400_000)}`,
    loadHistory(profile.id),
  ]);
  if (!appt) notFound();

  const today = istDate(now);
  const taken = new Set(logs.filter((l) => l.status === "taken").map((l) => `${l.med_id}:${l.at.getTime()}`));
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, -i));
  const skips = logs.filter((l) => l.status === "skipped").sort((a, b) => b.at.getTime() - a.at.getTime());
  const missed = logs.filter((l) => l.status === "missed").length;
  const dups = findDuplicates(meds);
  const since = new Date(now.getTime() - DAYS * 86_400_000);
  const changes = history.events.filter((e) => e.kind.startsWith("med_") && e.at >= since);
  const symptomCounts = [...history.symptoms.filter((s) => s.at >= since).reduce((acc, s) => acc.set(s.name, (acc.get(s.name) ?? 0) + 1), new Map<string, number>())];
  const medName = (medId: string) => meds.find((m) => m.id === medId)?.brand ?? "a medicine";
  const escort = chain.find((m) => m.id === appt.escort_id);

  return (
    <article className="mx-auto max-w-3xl space-y-6 bg-white p-6 text-[15px] print:p-0 md:p-10">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <h1 className="font-display text-3xl">Doctor Brief: {profile.elder_name}</h1>
          <p className="text-muted">
            For {appt.doctor}{appt.specialty ? ` (${appt.specialty})` : ""} · {showWhen(appt.starts_at)}
            {escort ? ` · accompanied by ${escort.name}` : ""}
          </p>
          <p className="text-sm text-muted">Prepared by the family on Dor</p>
        </div>
        <PrintButton />
      </header>

      {appt.purpose && <p><strong>Reason for visit:</strong> {appt.purpose}</p>}

      <section>
        <h2 className="font-display mb-2 text-xl">Current medicines and last {DAYS} days</h2>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              <th className="py-1.5">Medicine</th><th>Contains</th><th>When</th><th>Prescribed by</th><th className="text-right">Taken</th>
            </tr>
          </thead>
          <tbody>
            {meds.map((m) => {
              const slots = days.flatMap((d) => slotsForDay([m], d)).filter((s) => s.at >= m.created_at);
              const a = adherence(slots, taken, now);
              return (
                <tr key={m.id} className="border-b border-line align-top">
                  <td className="py-1.5 font-bold">{m.brand} {m.dose}</td>
                  <td>{m.salts.join(" + ") || "?"}</td>
                  <td>{m.times.join(", ")}{m.instructions ? ` · ${m.instructions}` : ""}</td>
                  <td>{m.prescribed_by || "?"}{m.prescribed_on ? `, ${m.prescribed_on}` : ""}</td>
                  <td className="text-right">{a.due ? `${a.taken}/${a.due}` : "new"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-sm text-muted">{missed} dose(s) never marked; {skips.length} skipped by choice (reasons below).</p>
      </section>

      {dups.length > 0 && (
        <section className="rounded-lg border-2 border-alarm p-3">
          <h2 className="font-bold text-alarm">Please check: same ingredient in more than one prescription</h2>
          <ul className="list-disc pl-5">
            {dups.map((d) => (
              <li key={d.salt}>{d.salt}: {d.meds.map((m) => `${m.brand} (${m.prescribed_by || "prescriber unknown"})`).join(" and ")}</li>
            ))}
          </ul>
        </section>
      )}

      {history.flags.length > 0 && (
        <section>
          <h2 className="font-display mb-2 text-xl">Symptoms that began after a medicine change</h2>
          <ul className="list-disc space-y-1 pl-5">
            {history.flags.map((f) => (
              <li key={f.symptom}>
                <strong>{f.symptom}</strong>: first noted {showDay(f.firstAt)}, {f.daysAfter} day(s) after “{f.change}”; {f.count} report(s) since.
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="font-display mb-2 text-xl">Medicine changes</h2>
          {changes.length ? (
            <ul className="space-y-1">{changes.map((e) => <li key={e.id}>{showDay(e.at)}: {e.label}</li>)}</ul>
          ) : (
            <p className="text-muted">None in the last {DAYS} days.</p>
          )}
        </section>
        <section>
          <h2 className="font-display mb-2 text-xl">How they’ve felt</h2>
          {symptomCounts.length ? (
            <ul className="space-y-1">{symptomCounts.map(([name, n]) => <li key={name}>{name}: {n} time(s)</li>)}</ul>
          ) : (
            <p className="text-muted">Nothing logged.</p>
          )}
        </section>
      </div>

      {skips.length > 0 && (
        <section>
          <h2 className="font-display mb-2 text-xl">Doses skipped by choice, in their words</h2>
          <ul className="space-y-1">
            {skips.slice(0, 10).map((l) => (
              <li key={`${l.med_id}${l.at.getTime()}`}>{showDay(l.at)} {showTime(l.at)}: {medName(l.med_id)}, “{l.reason || "no reason given"}”</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display mb-2 text-xl">Questions from the family</h2>
        {appt.questions ? (
          <ol className="list-decimal space-y-1 pl-5">{appt.questions.split("\n").filter(Boolean).map((q, i) => <li key={i}>{q}</li>)}</ol>
        ) : (
          <p className="text-muted">None.</p>
        )}
      </section>

      <footer className="border-t border-line pt-3 text-xs text-muted">
        Generated {showWhen(now)} from records kept by the family. Not a clinical record; dose timings are self-reported.
      </footer>
    </article>
  );
}
