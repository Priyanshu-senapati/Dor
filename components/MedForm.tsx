"use client";

import { useId, useMemo, useState } from "react";
import { BRAND_NAMES, resolveSalts, type SaltMed } from "@/lib/salts";
import { saveMed } from "@/app/actions";
import { field, label, primary } from "./ui";
import type { Med } from "@/lib/types";

const PRESETS = [
  ["08:00", "Morning, 8 AM"],
  ["14:00", "Afternoon, 2 PM"],
  ["18:00", "Evening, 6 PM"],
  ["21:00", "Night, 9 PM"],
] as const;

interface Props {
  others: SaltMed[];
  initial?: Med;
  submitLabel: string;
  needsApproval: boolean;
  elderName: string;
}

/** Add or change a medicine; checks its salts against everything already prescribed as you type. */
export function MedForm({ others, initial, submitLabel, needsApproval, elderName }: Props) {
  const id = useId();
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [typedSalt, setTypedSalt] = useState(initial && !resolveSalts(initial.brand).length ? initial.salts.join(", ") : "");
  const known = useMemo(() => resolveSalts(brand), [brand]);
  const salts = known.length ? known : typedSalt.toLowerCase().split(/\s*[,+]\s*/).filter(Boolean);
  const clashes = salts.flatMap((s) =>
    others.filter((o) => o.id !== initial?.id && o.id !== initial?.replaces_id && o.salts.includes(s)).map((o) => ({ salt: s, med: o })),
  );
  const custom = initial?.times.find((t) => !PRESETS.some(([v]) => v === t)) ?? "";

  return (
    <form action={saveMed} className="space-y-4">
      {initial && <input type="hidden" name="replaces" value={initial.id} />}
      <div>
        <label className={label} htmlFor={`${id}-brand`}>Medicine name, as on the strip</label>
        <input
          id={`${id}-brand`}
          name="brand"
          required
          maxLength={80}
          list={`${id}-brands`}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g. Telma-AM 40"
          className={field}
          autoComplete="off"
        />
        <datalist id={`${id}-brands`}>
          {BRAND_NAMES.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        <div aria-live="polite" className="mt-2 text-sm">
          {brand && known.length > 0 && (
            <p>
              <span className="font-bold text-sky">Contains:</span> {known.join(" + ")}
            </p>
          )}
          {brand && !known.length && (
            <div>
              <label className={label} htmlFor={`${id}-salt`}>
                Dor doesn’t know this brand. What’s in it? (printed under the name on the strip)
              </label>
              <input id={`${id}-salt`} name="salt" maxLength={80} value={typedSalt} onChange={(e) => setTypedSalt(e.target.value)} placeholder="e.g. amlodipine" className={field} />
            </div>
          )}
        </div>
        {clashes.length > 0 && (
          <div role="alert" className="mt-3 rounded-xl border border-alarm/30 bg-alarm/5 p-3">
            {clashes.map((c) => (
              <p key={`${c.salt}-${c.med.id}`} className="font-bold text-alarm">
                ⚠ {c.salt} is already in {c.med.brand}
                {c.med.prescribed_by ? ` (${c.med.prescribed_by})` : ""}.
              </p>
            ))}
            <p className="mt-1 text-sm text-muted">Taking both may double the dose. Check with the doctor or pharmacist before adding.</p>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor={`${id}-dose`}>Strength</label>
          <input id={`${id}-dose`} name="dose" maxLength={40} defaultValue={initial?.dose} placeholder="e.g. 5 mg" className={field} />
        </div>
        <div>
          <label className={label} htmlFor={`${id}-ppd`}>Tablets per dose</label>
          <input id={`${id}-ppd`} name="pillsPerDose" type="number" min={1} max={10} defaultValue={initial?.pills_per_dose ?? 1} className={field} />
        </div>
        <div>
          <label className={label} htmlFor={`${id}-left`}>Tablets at home</label>
          <input id={`${id}-left`} name="pillsLeft" type="number" min={0} max={2000} defaultValue={initial?.pills_left ?? ""} placeholder="optional" className={field} />
        </div>
      </div>

      <fieldset>
        <legend className={label}>When?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRESETS.map(([value, text]) => (
            <label key={value} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
              <input type="checkbox" name="time" value={value} defaultChecked={initial ? initial.times.includes(value) : value === "08:00"} className="h-5 w-5 accent-kite-deep" />
              {text}
            </label>
          ))}
          <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
            Other time
            <input type="time" name="time" defaultValue={custom} className="rounded-lg border border-line px-2 py-1" />
          </label>
        </div>
      </fieldset>

      <div>
        <label className={label} htmlFor={`${id}-ins`}>Instructions</label>
        <input id={`${id}-ins`} name="instructions" maxLength={120} defaultValue={initial?.instructions} placeholder="e.g. after food" className={field} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor={`${id}-by`}>Prescribed by</label>
          <input id={`${id}-by`} name="prescribedBy" maxLength={80} defaultValue={initial?.prescribed_by} placeholder="e.g. Dr Rao (Cardiology)" className={field} />
        </div>
        <div>
          <label className={label} htmlFor={`${id}-on`}>Prescribed on</label>
          <input id={`${id}-on`} name="prescribedOn" type="date" defaultValue={initial?.prescribed_on ?? ""} className={field} />
        </div>
        <div>
          <label className={label} htmlFor={`${id}-start`}>Start</label>
          <input id={`${id}-start`} name="startDate" type="date" defaultValue={initial?.start_date ?? ""} className={field} />
        </div>
        <div>
          <label className={label} htmlFor={`${id}-end`}>End (leave empty if ongoing)</label>
          <input id={`${id}-end`} name="endDate" type="date" defaultValue={initial?.end_date ?? ""} className={field} />
        </div>
      </div>

      {needsApproval && <p className="text-sm text-muted">{elderName} will be asked to approve this before it enters the schedule.</p>}
      <button className={`${primary} w-full`}>{submitLabel}</button>
    </form>
  );
}
