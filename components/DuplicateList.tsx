import type { SaltMed } from "@/lib/salts";

const when = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : null;

/** The Check warning: one active ingredient arriving through two prescriptions. */
export function DuplicateList({ dups }: { dups: { salt: string; meds: (SaltMed & { status?: string })[] }[] }) {
  return (
    <ul className="space-y-3">
      {dups.map((d) => (
        <li key={d.salt} className="rounded-xl bg-alarm/5 p-4">
          <p className="font-bold text-alarm">⚠ {d.salt[0].toUpperCase() + d.salt.slice(1)} appears in {d.meds.length} medicines</p>
          <ul className="mt-2 space-y-1">
            {d.meds.map((m) => (
              <li key={m.id}>
                <strong>{m.brand}</strong>
                <span className="text-muted">
                  {m.prescribed_by ? ` · ${m.prescribed_by}` : " · prescriber not recorded"}
                  {when(m.prescribed_on) ? `, ${when(m.prescribed_on)}` : ""}
                  {m.status === "pending" ? " · not approved yet" : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">Taking both may double the dose. Review with your doctor or pharmacist.</p>
        </li>
      ))}
    </ul>
  );
}
