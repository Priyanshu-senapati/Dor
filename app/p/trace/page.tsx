import { sql } from "@/lib/db";
import { requireCircle } from "@/lib/session";
import { loadHistory, CHANGE_KINDS } from "@/lib/history";
import { whyMissed } from "@/lib/insights";
import { SYMPTOMS } from "@/lib/symptoms";
import { istDate, showDay, showTime } from "@/lib/time";
import { logSymptom } from "../../actions";
import { Card, Flash, Pill, field, label, primary, type FlashParams } from "@/components/ui";
import { Submit } from "@/components/Submit";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default async function Trace({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const sp = await searchParams;
  const { profile, chain } = await requireCircle();
  const [{ events, symptoms, flags }, missRows] = await Promise.all([
    loadHistory(profile.id),
    sql<{ status: string; reason: string }>`select status, reason from dose_logs
      where profile_id = ${profile.id} and at > now() - interval '30 days' and at < now()`,
  ]);
  const misses = whyMissed(missRows);
  const top = misses[0];
  const insight = !top
    ? null
    : top.reason === "Never marked"
      ? "Most misses were never marked at all, so the reminder or the marking is where to start."
      : top.reason === "Ran out"
        ? "Most misses were supply problems, not memory. Watch the refills."
        : `The most common reason was “${top.reason}”. Worth raising with the doctor.`;
  const nameOf = (id: string | null) => chain.find((m) => m.id === id)?.name ?? "";

  const items = [
    ...events.map((e) => ({ at: e.at, kind: CHANGE_KINDS.includes(e.kind) ? "change" : e.kind === "skip" ? "skip" : "event", text: e.label, by: nameOf(e.member_id) })),
    ...symptoms.map((s) => ({ at: s.at, kind: "symptom", text: `${cap(s.name)}${s.note ? `: ${s.note}` : ""}`, by: nameOf(s.member_id) })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const days = [...new Set(items.map((i) => istDate(i.at)))];

  return (
    <div className="space-y-6">
      <Flash ok={sp.ok} error={sp.error} />
      <div>
        <h1 className="font-display text-4xl">Trace</h1>
        <p className="text-muted">How {profile.elder_name} has felt, lined up against every medicine change.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card title={flags.length ? "Worth raising with the doctor" : "No patterns yet"}>
            {flags.length ? (
              <ul className="space-y-3">
                {flags.map((f) => (
                  <li key={f.symptom} className="rounded-xl border border-kite/40 bg-[#fff7f0] p-4">
                    <p className="text-lg font-bold">
                      {cap(f.symptom)} started {f.daysAfter === 0 ? "the same day as" : `${f.daysAfter} day${f.daysAfter === 1 ? "" : "s"} after`}: {f.change}
                    </p>
                    <p className="text-muted">
                      First logged {showDay(f.firstAt)} · logged {f.count} time{f.count === 1 ? "" : "s"} since
                    </p>
                  </li>
                ))}
                <p className="text-sm text-muted">Dor doesn’t diagnose. It shows timing so the doctor can judge. Review with your doctor or pharmacist.</p>
              </ul>
            ) : (
              <p className="text-muted">When a symptom first appears within 7 days of a medicine change, Dor points it out here and on the Doctor Brief.</p>
            )}
          </Card>

          <Card title="Why doses were missed, last 30 days">
            {misses.length === 0 ? (
              <p className="text-muted">No missed doses in the last 30 days.</p>
            ) : (
              <>
                {insight && <p className="mb-4 font-bold">{insight}</p>}
                <ul className="space-y-3">
                  {misses.map((m) => (
                    <li key={m.reason}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span>{m.reason}</span>
                        <span className="text-sm tabular-nums text-muted">
                          {m.count} · {m.pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${m.reason}: ${m.pct}%`}>
                        <div className="h-full rounded-full bg-warn" style={{ width: `${m.pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted">Reasons come from the elder’s own “I chose to skip” answers and the family’s “What happened?”.</p>
              </>
            )}
          </Card>

          <Card title="Everything, in order">
            {days.length === 0 && <p className="text-muted">Nothing logged yet.</p>}
            <ol className="space-y-5">
              {days.map((d) => (
                <li key={d}>
                  <p className="mb-2 font-bold">{showDay(new Date(`${d}T12:00:00+05:30`))}</p>
                  <ul className="space-y-2 border-l-2 border-line pl-4">
                    {items
                      .filter((i) => istDate(i.at) === d)
                      .map((i, k) => (
                        <li key={k} className="flex flex-wrap items-baseline gap-2">
                          <span className="w-16 text-sm text-muted">{showTime(i.at)}</span>
                          {i.kind === "change" && <Pill tone="info">Medicine</Pill>}
                          {i.kind === "symptom" && <Pill tone="warn">Felt</Pill>}
                          {i.kind === "skip" && <Pill tone="plain">Skipped</Pill>}
                          <span className={i.kind === "change" ? "font-bold" : ""}>{i.text}</span>
                          {i.by && i.kind === "symptom" && <span className="text-sm text-muted">· noted by {i.by}</span>}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card title={`How is ${profile.elder_name} feeling?`}>
          <form action={logSymptom} className="space-y-3">
            <fieldset>
              <legend className={label}>Pick one</legend>
              <div className="grid grid-cols-2 gap-2">
                {[...SYMPTOMS, "other"].map((s, i) => (
                  <label key={s} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
                    <input type="radio" name="name" value={s} defaultChecked={i === 0} className="h-5 w-5 accent-kite-deep" />
                    {cap(s)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label className={label} htmlFor="other">If other, what?</label>
              <input id="other" name="other" maxLength={40} className={field} />
            </div>
            <div>
              <label className={label} htmlFor="note">Note (optional)</label>
              <input id="note" name="note" maxLength={200} placeholder="e.g. after standing up" className={field} />
            </div>
            <Submit className={`${primary} w-full`}>Log it</Submit>
          </form>
        </Card>
      </div>
    </div>
  );
}
