import { ackAlertAction, reportOutcomeAction, resolveAlertAction } from "@/app/actions";
import { ESCALATE_EVERY_MIN } from "@/lib/chain";
import { doseRef } from "@/lib/notify";
import { DOSE_OUTCOMES } from "@/lib/outcomes";
import { showTime } from "@/lib/time";
import type { Alert, Member } from "@/lib/types";
import { DoseActions } from "./DoseActions";
import { CheckIcon } from "./icons";
import { Submit } from "./Submit";
import { Pill, btn, primary, quiet } from "./ui";

export interface TrailLine {
  label: string;
  at: Date;
}

const KIND = { dose: "Missed dose", refill: "Refill", escort: "Doctor visit" } as const;
const choice = `${btn} justify-start border border-line bg-white px-3 py-2 text-left font-bold text-ink hover:border-ink`;

/** One care event: who owns it, what happens next, what has happened so far. */
export function AlertCard({ alert, chain, duty, me, elderName, now, trail = [] }: {
  alert: Alert;
  /** Everyone, for names. */
  chain: Member[];
  /** Today's chain, which the alert's level indexes into. */
  duty: Member[];
  me: Member;
  elderName: string;
  now: Date;
  trail?: TrailLine[];
}) {
  const person = (id: string | null) => chain.find((m) => m.id === id);
  const owner = person(alert.owner_id);
  const acker = person(alert.acked_by);
  const next = duty[alert.level + 1];
  const minsLeft = Math.max(0, Math.ceil(ESCALATE_EVERY_MIN - (now.getTime() - alert.last_notified_at.getTime()) / 60_000));
  const dose = doseRef(alert.ref_key);
  const mine = owner?.id === me.id;
  const claimed = alert.status === "acked";
  const first = elderName.split(" ")[0];

  return (
    <li className={`rounded-xl border p-4 ${claimed ? "border-leaf/30 bg-leaf/5" : "border-kite/40 bg-[#fff7f0]"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={claimed ? "ok" : "warn"}>{KIND[alert.kind]}</Pill>
        <Pill tone={claimed ? "ok" : "plain"}>{claimed ? "Claimed" : "Open"}</Pill>
        <span className="text-sm tabular-nums text-muted">raised {showTime(alert.created_at)}</span>
      </div>
      <p className="mt-2 text-lg font-bold">{alert.title}</p>
      <p className="text-muted">{alert.body}</p>

      {claimed ? (
        <p className="mt-3 flex items-center gap-2 font-bold text-leaf">
          <CheckIcon /> {acker?.id === me.id ? "You are" : `${acker?.name ?? "Someone"} is`} handling this
          {alert.acked_at ? ` (since ${showTime(alert.acked_at)})` : ""}
        </p>
      ) : (
        <p className="mt-3 font-bold">
          {mine ? "This is with you." : `With ${owner?.name ?? "the circle"}.`}{" "}
          <span className="font-normal text-muted">
            {next ? `Passes to ${next.name} in ${minsLeft} min if nobody answers.` : "Last link in the chain. Everyone can step in."}
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-start gap-2">
        {!claimed && !(dose && me.role === "elder") && (
          <form action={ackAlertAction}>
            <input type="hidden" name="id" value={alert.id} />
            <Submit className={primary}>{alert.kind === "escort" ? `I’ll take ${first}` : "I’m on it"}</Submit>
          </form>
        )}
        {dose && (me.role === "elder" || !claimed || acker?.id !== me.id) && <DoseActions medId={dose.med} at={dose.at} from="/p" />}
        {claimed && !dose && (
          <form action={resolveAlertAction}>
            <input type="hidden" name="id" value={alert.id} />
            <Submit className={quiet}>Mark done</Submit>
          </form>
        )}
      </div>

      {dose && claimed && acker?.id === me.id && me.role !== "elder" && (
        <fieldset className="mt-3">
          <legend className="mb-2 font-bold">What happened?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {DOSE_OUTCOMES.map((o) => (
              <form key={o.id} action={reportOutcomeAction}>
                <input type="hidden" name="id" value={alert.id} />
                <input type="hidden" name="outcome" value={o.id} />
                <Submit className={`${choice} w-full`}>{o.label(first)}</Submit>
              </form>
            ))}
          </div>
        </fieldset>
      )}

      {trail.length > 0 && (
        <ol className="mt-4 space-y-1 border-t border-line pt-3 text-sm text-muted" aria-label="What has happened so far">
          {trail.map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-16 shrink-0 tabular-nums">{showTime(t.at)}</span>
              <span>{t.label}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
