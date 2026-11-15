import { ackAlertAction, resolveAlertAction } from "@/app/actions";
import { ESCALATE_EVERY_MIN } from "@/lib/chain";
import { doseRef } from "@/lib/notify";
import { showTime } from "@/lib/time";
import type { Alert, Member } from "@/lib/types";
import { DoseActions } from "./DoseActions";
import { Pill, primary, quiet } from "./ui";
import { CheckIcon } from "./icons";
import { Submit } from "./Submit";

const KIND = { dose: "Missed dose", refill: "Refill", escort: "Doctor visit" } as const;

export function AlertCard({ alert, chain, me, elderName, now }: {
  alert: Alert;
  chain: Member[];
  me: Member;
  elderName: string;
  now: Date;
}) {
  const owner = chain.find((m) => m.id === alert.owner_id);
  const acker = chain.find((m) => m.id === alert.acked_by);
  const next = chain[alert.level + 1];
  const minsLeft = Math.max(0, Math.ceil(ESCALATE_EVERY_MIN - (now.getTime() - alert.last_notified_at.getTime()) / 60_000));
  const dose = doseRef(alert.ref_key);
  const mine = owner?.id === me.id;

  return (
    <li className={`rounded-xl border p-4 ${alert.status === "acked" ? "border-leaf/30 bg-leaf/5" : "border-kite/40 bg-[#fff7f0]"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={alert.status === "acked" ? "ok" : "warn"}>{KIND[alert.kind]}</Pill>
        <span className="text-sm text-muted">raised {showTime(alert.created_at)}</span>
      </div>
      <p className="mt-2 text-lg font-bold">{alert.title}</p>
      <p className="text-muted">{alert.body}</p>

      {alert.status === "acked" ? (
        <p className="mt-3 flex items-center gap-2 font-bold text-leaf">
          <CheckIcon /> {acker?.id === me.id ? "You are" : `${acker?.name ?? "Someone"} is`} handling this{alert.acked_at ? ` (since ${showTime(alert.acked_at)})` : ""}
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
        {alert.status === "open" && !(dose && me.role === "elder") && (
          <form action={ackAlertAction}>
            <input type="hidden" name="id" value={alert.id} />
            <Submit className={primary}>{alert.kind === "escort" ? `I’ll take ${elderName}` : "I’m on it"}</Submit>
          </form>
        )}
        {dose && <DoseActions medId={dose.med} at={dose.at} from="/p" />}
        {alert.status === "acked" && !dose && (
          <form action={resolveAlertAction}>
            <input type="hidden" name="id" value={alert.id} />
            <Submit className={quiet}>Mark done</Submit>
          </form>
        )}
      </div>
    </li>
  );
}
