import { sql } from "@/lib/db";
import { requireCircle } from "@/lib/session";
import { ESCALATE_EVERY_MIN } from "@/lib/chain";
import { showWhen } from "@/lib/time";
import { moveMember } from "../../actions";
import { Card, Flash, Pill, quiet, type FlashParams } from "@/components/ui";
import type { Alert } from "@/lib/types";

export default async function Circle({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const sp = await searchParams;
  const { profile, member, chain } = await requireCircle();
  const history = await sql<Alert>`select * from alerts where profile_id = ${profile.id} order by created_at desc limit 20`;
  const nameOf = (id: string | null) => chain.find((m) => m.id === id)?.name ?? "someone";

  return (
    <div className="space-y-6">
      <Flash ok={sp.ok} error={sp.error} />
      <h1 className="font-display text-4xl">The chain</h1>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card eyebrow="Hold" title="Who holds the string, in order">
          <ol className="space-y-2">
            {chain.map((m, i) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-display grid h-9 w-9 place-items-center rounded-full bg-ink text-white">{i + 1}</span>
                  <div>
                    <p className="font-bold">
                      {m.name} {m.id === member.id && <span className="text-muted">(you)</span>}
                    </p>
                    <p className="text-sm text-muted">{m.role === "elder" ? "Asked first about their own doses" : m.role}</p>
                  </div>
                </div>
                {m.role !== "elder" && (
                  <div className="flex gap-1">
                    {(["up", "down"] as const).map((dir) => (
                      <form key={dir} action={moveMember}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="dir" value={dir} />
                        <button className={quiet} aria-label={`Move ${m.name} ${dir}`}>{dir === "up" ? "↑" : "↓"}</button>
                      </form>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-muted">
            A missed dose goes to link 1 first. If nobody taps “I’m on it” within {ESCALATE_EVERY_MIN} minutes, it passes to the
            next link, and so on. Refills and doctor visits start with link 2. The moment someone answers, everyone else is told,
            so nobody doubles up and nobody assumes.
          </p>
        </Card>

        <div className="space-y-6">
          <Card eyebrow="Invite" title="Add family to the chain">
            <p className="text-muted">Share these two things privately. New people join at the end of the chain.</p>
            <p className="mt-3 text-lg">
              Code: <strong className="font-display text-2xl tracking-wider">{profile.code}</strong>
            </p>
            <p className="text-muted">Passcode: the one chosen when the circle was made.</p>
          </Card>

          <Card eyebrow="Record" title="Recent alerts">
            {history.length === 0 && <p className="text-muted">No alerts yet.</p>}
            <ul className="space-y-3">
              {history.map((a) => (
                <li key={a.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={a.status === "resolved" ? "ok" : a.status === "acked" ? "info" : "warn"}>{a.status}</Pill>
                    <span className="text-sm text-muted">{showWhen(a.created_at)}</span>
                  </div>
                  <p className="font-bold">{a.title}</p>
                  <p className="text-sm text-muted">
                    {a.status === "open" && `With ${nameOf(a.owner_id)}`}
                    {a.status === "acked" && `${nameOf(a.acked_by)} is handling it`}
                    {a.status === "resolved" && a.resolution}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
