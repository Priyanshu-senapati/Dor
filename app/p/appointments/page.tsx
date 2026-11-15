import Link from "next/link";
import { sql } from "@/lib/db";
import { requireCircle } from "@/lib/session";
import { showWhen } from "@/lib/time";
import { addAppointment, addQuestion, claimEscortAction } from "../../actions";
import { Card, Flash, field, label, primary, quiet, type FlashParams } from "@/components/ui";
import type { Appointment } from "@/lib/types";

export default async function Appointments({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const sp = await searchParams;
  const { profile, chain } = await requireCircle();
  const now = new Date();
  const appts = await sql<Appointment>`select * from appointments where profile_id = ${profile.id} order by starts_at`;
  const upcoming = appts.filter((a) => a.starts_at > now);
  const past = appts.filter((a) => a.starts_at <= now).reverse();
  const nameOf = (id: string | null) => chain.find((m) => m.id === id)?.name;

  return (
    <div className="space-y-6">
      <Flash ok={sp.ok} error={sp.error} />
      <h1 className="font-display text-4xl">Doctor visits</h1>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {upcoming.length === 0 && (
            <Card title="No visits booked">
              <p className="text-muted">Add one and Dor reminds everyone, then asks who’s taking {profile.elder_name}.</p>
            </Card>
          )}
          {upcoming.map((a) => (
            <Card key={a.id} eyebrow={showWhen(a.starts_at)} title={`${a.doctor}${a.specialty ? ` · ${a.specialty}` : ""}`}>
              <p className="text-muted">{[a.location, a.purpose].filter(Boolean).join(" · ")}</p>
              {a.escort_id ? (
                <p className="mt-3 font-bold text-leaf">✓ {nameOf(a.escort_id)} is taking {profile.elder_name}</p>
              ) : (
                <form action={claimEscortAction} className="mt-3">
                  <input type="hidden" name="id" value={a.id} />
                  <button className={primary}>I’ll take {profile.elder_name}</button>
                </form>
              )}
              <div className="mt-4">
                <p className="font-bold">Questions for the doctor</p>
                {a.questions ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {a.questions.split("\n").filter(Boolean).map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                ) : (
                  <p className="text-muted">None yet. Anyone in the circle can add one.</p>
                )}
                <form action={addQuestion} className="mt-2 flex gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <label className="sr-only" htmlFor={`q-${a.id}`}>Add a question</label>
                  <input id={`q-${a.id}`} name="question" maxLength={300} placeholder="Add a question…" className={field} />
                  <button className={quiet}>Add</button>
                </form>
              </div>
              <Link href={`/p/brief/${a.id}`} className={`${quiet} -ml-3 mt-3`}>Open the Doctor Brief →</Link>
            </Card>
          ))}
          {past.length > 0 && (
            <Card eyebrow="Past" title="Earlier visits">
              <ul className="space-y-1 text-muted">
                {past.map((a) => (
                  <li key={a.id}>
                    {showWhen(a.starts_at)} · {a.doctor}
                    {nameOf(a.escort_id) ? ` · went with ${nameOf(a.escort_id)}` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card eyebrow="New" title="Add a visit">
          <form action={addAppointment} className="space-y-3">
            <div>
              <label className={label} htmlFor="doctor">Doctor</label>
              <input id="doctor" name="doctor" required maxLength={80} placeholder="e.g. Dr Meera Sharma" className={field} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="specialty">Speciality</label>
                <input id="specialty" name="specialty" maxLength={60} placeholder="Cardiology" className={field} />
              </div>
              <div>
                <label className={label} htmlFor="location">Where</label>
                <input id="location" name="location" maxLength={120} placeholder="Clinic, area" className={field} />
              </div>
              <div>
                <label className={label} htmlFor="date">Date</label>
                <input id="date" name="date" type="date" required className={field} />
              </div>
              <div>
                <label className={label} htmlFor="time">Time</label>
                <input id="time" name="time" type="time" required className={field} />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="purpose">Purpose</label>
              <input id="purpose" name="purpose" maxLength={160} placeholder="e.g. BP review" className={field} />
            </div>
            <div>
              <label className={label} htmlFor="questions">Questions to ask (one per line)</label>
              <textarea id="questions" name="questions" rows={3} maxLength={1000} className={field} />
            </div>
            <button className={`${primary} w-full`}>Add visit</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
