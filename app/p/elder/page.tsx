import Link from "next/link";
import { sql } from "@/lib/db";
import { requireCircle } from "@/lib/session";
import { classifySlot, slotKey, slotsForDay } from "@/lib/schedule";
import { istDate, showTime } from "@/lib/time";
import { DoseActions } from "@/components/DoseActions";
import { ReadAloud } from "@/components/ReadAloud";
import { Flash, Kite, type FlashParams } from "@/components/ui";
import type { DoseLog, Med } from "@/lib/types";

/** Big, one-thing-at-a-time screen for the elder: what’s next, and two buttons. */
export default async function ElderMode({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const sp = await searchParams;
  const { profile } = await requireCircle();
  const now = new Date();
  const today = istDate(now);
  const [meds, logs] = await Promise.all([
    sql<Med>`select * from medications where profile_id = ${profile.id} and status = 'active'`,
    sql<DoseLog>`select med_id, at, status, reason, marked_by from dose_logs where profile_id = ${profile.id} and at >= ${new Date(now.getTime() - 86_400_000)}`,
  ]);
  const medById = new Map(meds.map((m) => [m.id, m]));
  const done = new Set(logs.filter((l) => l.status !== "missed").map((l) => `${l.med_id}:${l.at.getTime()}`));
  const slots = slotsForDay(meds, today).filter((s) => s.at >= (medById.get(s.medId)?.created_at ?? now));
  const remaining = slots.filter((s) => !done.has(slotKey(s)));
  const next = remaining.find((s) => classifySlot(s.at, now, false) !== "future") ?? remaining[0];
  const med = next && medById.get(next.medId);
  const first = profile.elder_name.split(" ")[0];
  const speech = med
    ? `${first}, your next medicine is ${med.brand}${med.dose ? `, ${med.dose}` : ""}, at ${showTime(next.at)}. ${med.instructions}`
    : `${first}, you have taken all your medicines for today. Well done.`;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Flash ok={sp.ok} error={sp.error} />
      <p className="text-center text-xl text-muted">
        {slots.length - remaining.length} of {slots.length} done today
      </p>
      <div className="rounded-3xl border border-line bg-white p-8 text-center shadow-[0_2px_4px_rgba(31,42,68,0.06),0_24px_48px_-24px_rgba(31,42,68,0.35)]">
        {med && next ? (
          <>
            <p className="text-2xl text-muted">Next, at {showTime(next.at)}</p>
            <p className="font-display mt-2 text-5xl leading-tight">{med.brand}</p>
            {med.dose && <p className="mt-1 text-3xl">{med.dose}</p>}
            {med.instructions && <p className="mt-3 text-2xl font-bold text-kite-deep">{med.instructions}</p>}
            <div className="mt-8">
              <DoseActions medId={med.id} at={next.at.getTime()} from="/p/elder" big />
            </div>
          </>
        ) : (
          <>
            <Kite className="mx-auto h-20 w-20" />
            <p className="font-display mt-4 text-4xl">All done for today</p>
            <p className="mt-2 text-2xl text-muted">Your family can see it. Rest easy.</p>
          </>
        )}
      </div>
      <ReadAloud text={speech} />
      <p className="text-center">
        <Link href="/p" className="text-lg font-bold text-sky underline">Family view</Link>
      </p>
    </div>
  );
}
