import { markDose } from "@/app/actions";
import { SKIP_REASONS } from "@/lib/symptoms";
import { good, primary, secondary } from "./ui";

interface Props {
  medId: string;
  at: number;
  from: string;
  big?: boolean;
}

function Hidden({ medId, at, from, status }: Omit<Props, "big"> & { status: string }) {
  return (
    <>
      <input type="hidden" name="med" value={medId} />
      <input type="hidden" name="at" value={at} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="status" value={status} />
    </>
  );
}

/** "Taken" or "I chose to skip" with a reason — skipping is a valid choice, recorded neutrally. */
export function DoseActions({ medId, at, from, big = false }: Props) {
  const size = big ? "w-full text-xl px-6 py-5 rounded-2xl" : "";
  return (
    <div className={`flex flex-wrap items-start gap-2 ${big ? "flex-col" : ""}`}>
      <form action={markDose} className={big ? "w-full" : ""}>
        <Hidden medId={medId} at={at} from={from} status="taken" />
        <button className={`${good} ${size}`}>✓ {big ? "I took it" : "Taken"}</button>
      </form>
      <details className={big ? "w-full" : ""}>
        <summary className={`${secondary} ${size} cursor-pointer list-none`}>{big ? "I chose to skip" : "Chose to skip"}</summary>
        <form action={markDose} className="mt-2 space-y-2 rounded-xl border border-line bg-paper p-3">
          <Hidden medId={medId} at={at} from={from} status="skipped" />
          <fieldset>
            <legend className={`mb-2 font-bold ${big ? "text-xl" : ""}`}>Why? Your family will see your reason.</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {SKIP_REASONS.map((r, i) => (
                <label key={r.label} className={`flex items-center gap-2 rounded-lg bg-white px-3 py-2 ${big ? "text-lg" : ""}`}>
                  <input type="radio" name="reason" value={r.label} defaultChecked={i === 0} className="h-5 w-5 accent-kite-deep" />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <button className={`${primary} ${big ? "w-full text-lg" : ""}`}>Save my choice</button>
        </form>
      </details>
    </div>
  );
}
