import { sql } from "@/lib/db";
import { requireCircle } from "@/lib/session";
import { ESCALATE_EVERY_MIN } from "@/lib/chain";
import { careLoad, loadWarning, type LoadInput } from "@/lib/insights";
import { istDate, showDay, showTime, showWhen } from "@/lib/time";
import { endAwayAction, moveMember, setAwayAction } from "../../actions";
import { Card, Flash, Pill, field, label, primary, quiet, secondary, type FlashParams } from "@/components/ui";
import { ChevronDownIcon, ChevronUpIcon } from "@/components/icons";
import { Submit } from "@/components/Submit";
import type { Alert } from "@/lib/types";

const STATUS = { open: "Open", acked: "Claimed", resolved: "Resolved" } as const;
const day = (d: string) => showDay(new Date(`${d}T12:00:00+05:30`));

export default async function Circle({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const sp = await searchParams;
  const { profile, member, chain, away } = await requireCircle();
  const [history, loadRows] = await Promise.all([
    sql<Alert>`select * from alerts where profile_id = ${profile.id} order by created_at desc limit 12`,
    sql<LoadInput>`select m.id, m.name,
        (select count(*) from alerts a where a.acked_by = m.id and a.created_at > now() - interval '30 days')::int as alerts,
        (select count(*) from appointments ap where ap.escort_id = m.id and ap.starts_at > now() - interval '30 days')::int as visits,
        (select count(*) from events e where e.member_id = m.id and e.kind = 'refill' and e.at > now() - interval '30 days')::int as refills
      from members m where m.profile_id = ${profile.id} and m.role <> 'elder'`,
  ]);
  const trails = history.length
    ? await sql<{ alert_id: string; label: string; at: Date }>`select alert_id, label, at from events
        where alert_id = any(${history.map((a) => a.id)}::uuid[]) order by at`
    : [];
  const nameOf = (id: string | null) => chain.find((m) => m.id === id)?.name ?? "someone";
  const load = careLoad(loadRows);
  const warning = loadWarning(load);
  const helpers = chain.filter((m) => m.role !== "elder");
  const busiest = load[0];
  const lightest = load[load.length - 1];
  const canRebalance =
    warning && busiest && lightest && helpers.findIndex((m) => m.id === lightest.id) > helpers.findIndex((m) => m.id === busiest.id);
  const today = istDate(new Date());
  const awayNow = (id: string) => away.find((a) => a.member_id === id && a.starts_on <= today);
  const covers = helpers.filter((m) => m.id !== member.id);

  return (
    <div className="space-y-6">
      <Flash ok={sp.ok} error={sp.error} />
      <h1 className="font-display text-4xl">The chain</h1>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card title="Who holds the string, in order">
            <ol className="space-y-2">
              {chain.map((m, i) => {
                const off = awayNow(m.id);
                return (
                  <li key={m.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 ${off ? "bg-ink/5" : "bg-paper"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`font-display grid h-9 w-9 place-items-center rounded-full text-white ${off ? "bg-muted" : "bg-ink"}`}>{i + 1}</span>
                      <div>
                        <p className="font-bold">
                          {m.name} {m.id === member.id && <span className="text-muted">(you)</span>}
                        </p>
                        <p className="text-sm text-muted">
                          {off
                            ? `Away until ${day(off.ends_on)}. ${nameOf(off.cover_id)} is covering, so Dor skips ${m.name}.`
                            : m.role === "elder" ? "Asked first about their own doses" : m.role}
                        </p>
                      </div>
                    </div>
                    {m.role !== "elder" && (
                      <div className="flex gap-1">
                        {(["up", "down"] as const).map((dir) => (
                          <form key={dir} action={moveMember}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="dir" value={dir} />
                            <button className={quiet} aria-label={`Move ${m.name} ${dir}`}>
                              {dir === "up" ? <ChevronUpIcon /> : <ChevronDownIcon />}
                            </button>
                          </form>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-muted">
              A missed dose goes to link 1 first. If nobody taps “I’m on it” within {ESCALATE_EVERY_MIN} minutes, it passes to the
              next link, and so on. Refills and doctor visits start with the first family member. The moment someone answers,
              everyone else is told, so nobody doubles up and nobody assumes.
            </p>
          </Card>

          <Card title="Care load, last 30 days">
            {load.length === 0 ? (
              <p className="text-muted">Once family join, Dor shows who is carrying the care.</p>
            ) : (
              <>
                <ul className="space-y-3">
                  {load.map((l) => (
                    <li key={l.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-bold">{l.name}</span>
                        <span className="text-sm tabular-nums text-muted">
                          {l.total} event{l.total === 1 ? "" : "s"} · {l.pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-3 overflow-hidden rounded-full bg-line" role="img" aria-label={`${l.name}: ${l.pct}% of care events`}>
                        <div className={`h-full rounded-full ${l === busiest && warning ? "bg-kite-deep" : "bg-sky"}`} style={{ width: `${l.pct}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted">Counts alerts claimed, doctor visits taken and refills bought.</p>
                {warning && (
                  <div className="mt-4 rounded-xl border border-kite/40 bg-[#fff7f0] p-4">
                    <p className="font-bold">{warning}</p>
                    <p className="mt-1 text-muted">One person quietly becoming the full-time caregiver is how care falls apart. Share the first call.</p>
                    {canRebalance && (
                      <form action={moveMember} className="mt-3">
                        <input type="hidden" name="id" value={lightest.id} />
                        <input type="hidden" name="dir" value="up" />
                        <Submit className={secondary}>Let {lightest.name} take the first call</Submit>
                      </form>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Going away? Hand over the string">
            {away.length > 0 && (
              <ul className="mb-4 space-y-2">
                {away.map((a) => (
                  <li key={a.id} className="rounded-xl bg-paper px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong>{nameOf(a.member_id)}</strong> away {day(a.starts_on)} to {day(a.ends_on)} ·{" "}
                        <strong>{nameOf(a.cover_id)}</strong> covering
                      </span>
                      <form action={endAwayAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <Submit className={quiet}>{a.member_id === member.id ? "I’m back" : "End cover"}</Submit>
                      </form>
                    </div>
                    {a.briefing && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-bold text-sky">Briefing sent to {nameOf(a.cover_id)}</summary>
                        <p className="mt-2 max-w-prose">{a.briefing}</p>
                        <p className="mt-1 text-sm text-muted">
                          {a.briefing_ai
                            ? "Written by Google Gemini from Dor’s records. Not medical advice."
                            : "Written by Dor from its records."}
                        </p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {member.role === "elder" ? (
              <p className="text-muted">Family members can hand over their part of the chain here when they travel.</p>
            ) : covers.length === 0 ? (
              <p className="text-muted">Invite someone else to the circle first, so there is someone to cover for you.</p>
            ) : (
              <form action={setAwayAction} className="space-y-3">
                <p className="text-muted">
                  While you’re away, Dor skips you in the chain. Your open alerts and any visits you were taking move to your cover,
                  and they get an email listing them.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="starts">From</label>
                    <input id="starts" name="starts" type="date" required defaultValue={today} className={field} />
                  </div>
                  <div>
                    <label className={label} htmlFor="ends">Until</label>
                    <input id="ends" name="ends" type="date" required className={field} />
                  </div>
                </div>
                <div>
                  <label className={label} htmlFor="cover">Who covers for you?</label>
                  <select id="cover" name="cover" className={field}>
                    {covers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <Submit className={`${primary} w-full`} pending="Handing over…">Hand over my part</Submit>
              </form>
            )}
          </Card>

          <Card title="Add family to the chain">
            <p className="text-muted">Share these two things privately. New people join at the end of the chain.</p>
            <p className="mt-3 text-lg">
              Code: <strong className="font-display text-2xl tracking-wider">{profile.code}</strong>
            </p>
            <p className="text-muted">Passcode: the one chosen when the circle was made.</p>
          </Card>

          <Card title="Every care event, start to finish">
            {history.length === 0 && <p className="text-muted">No alerts yet.</p>}
            <ul className="space-y-4">
              {history.map((a) => {
                const steps = trails.filter((t) => t.alert_id === a.id);
                return (
                  <li key={a.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={a.status === "resolved" ? "ok" : a.status === "acked" ? "info" : "warn"}>{STATUS[a.status]}</Pill>
                      <span className="text-sm tabular-nums text-muted">{showWhen(a.created_at)}</span>
                    </div>
                    <p className="font-bold">{a.title}</p>
                    <p className="text-sm text-muted">
                      {a.status === "open" && `With ${nameOf(a.owner_id)}`}
                      {a.status === "acked" && `${nameOf(a.acked_by)} is handling it`}
                      {a.status === "resolved" && a.resolution}
                    </p>
                    {steps.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-sm font-bold text-sky">Show the trail ({steps.length} step{steps.length === 1 ? "" : "s"})</summary>
                        <ol className="mt-2 space-y-1 border-l-2 border-line pl-3 text-sm text-muted">
                          {steps.map((s, i) => (
                            <li key={i}>
                              <span className="tabular-nums">{showTime(s.at)}</span> · {s.label}
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
