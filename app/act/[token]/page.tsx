import Link from "next/link";
import { sql } from "@/lib/db";
import { loadCircle } from "@/lib/session";
import { isUuid } from "@/lib/care";
import { verifyToken } from "@/lib/token";
import { showTime } from "@/lib/time";
import { SKIP_REASONS } from "@/lib/symptoms";
import { respondFromEmail } from "../../actions";
import { Kite, good, primary } from "@/components/ui";
import type { Alert, EmailAction, Med } from "@/lib/types";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <Kite className="h-9 w-9" />
        <span className="font-display text-2xl font-semibold">Dor</span>
      </div>
      <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">{children}</div>
    </main>
  );
}

const Expired = ({ text }: { text: string }) => (
  <Shell>
    <h1 className="font-display text-3xl">{text}</h1>
    <p className="mt-2 text-muted">Links in Dor emails work for 24 hours.</p>
    <Link href="/" className={`${primary} mt-5`}>Open Dor</Link>
  </Shell>
);

/** Confirm page for one-click email links. Showing it changes nothing; the button below does. */
export default async function Act({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const action = verifyToken<EmailAction>(token);
  if (!action) return <Expired text="This link has expired" />;
  const circle = await loadCircle(action.p, action.m);
  if (!circle) return <Expired text="You’re no longer in this circle" />;
  const hidden = <input type="hidden" name="token" value={token} />;

  if (action.a === "ack") {
    const [alert] = action.id && isUuid(action.id)
      ? await sql<Alert & { acker: string | null }>`select a.*, m.name as acker from alerts a left join members m on m.id = a.acked_by
          where a.id = ${action.id} and a.profile_id = ${circle.profile.id}`
      : [];
    if (!alert) return <Expired text="This alert no longer exists" />;
    if (alert.status !== "open") {
      return (
        <Shell>
          <h1 className="font-display text-3xl">Already handled</h1>
          <p className="mt-2 text-lg">{alert.status === "acked" ? `${alert.acker ?? "Someone"} is on it.` : alert.resolution || "Resolved."}</p>
          <Link href="/p" className={`${primary} mt-5`}>Open Dor</Link>
        </Shell>
      );
    }
    return (
      <Shell>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-kite-deep">{circle.member.name}, this one is with you</p>
        <h1 className="font-display mt-2 text-3xl">{alert.title}</h1>
        <p className="mt-2 text-muted">{alert.body}</p>
        <form action={respondFromEmail} className="mt-6">
          {hidden}
          <button className={`${primary} w-full text-lg`}>{alert.kind === "escort" ? `I’ll take ${circle.profile.elder_name}` : "I’m on it"}</button>
        </form>
        <p className="mt-3 text-sm text-muted">Everyone else in the circle will be told you’ve got it.</p>
      </Shell>
    );
  }

  const [med] = action.med && isUuid(action.med)
    ? await sql<Med>`select * from medications where id = ${action.med} and profile_id = ${circle.profile.id}`
    : [];
  if (!med || !action.at) return <Expired text="This dose couldn’t be found" />;
  return (
    <Shell>
      <p className="text-lg text-muted">Your {showTime(new Date(action.at))} medicine</p>
      <h1 className="font-display mt-1 text-4xl">{med.brand} {med.dose}</h1>
      {med.instructions && <p className="mt-2 text-xl font-bold text-kite-deep">{med.instructions}</p>}
      <form action={respondFromEmail} className="mt-6 space-y-3">
        {hidden}
        {action.a === "taken" ? (
          <button className={`${good} w-full py-4 text-xl`}>✓ Yes, I took it</button>
        ) : (
          <>
            <fieldset>
              <legend className="mb-2 text-xl font-bold">Why are you skipping it? Your family will see your reason.</legend>
              <div className="space-y-2">
                {SKIP_REASONS.map((r, i) => (
                  <label key={r.label} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-lg">
                    <input type="radio" name="reason" value={r.label} defaultChecked={i === 0} className="h-6 w-6 accent-kite-deep" />
                    {r.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button className={`${primary} w-full py-4 text-xl`}>Save my choice</button>
          </>
        )}
      </form>
    </Shell>
  );
}
