/** "What happened?" choices for a claimed missed dose, and what each one does. */
export interface DoseOutcome {
  id: string;
  label: (elderFirstName: string) => string;
  /** Record the dose as this. */
  dose?: "taken" | "skipped";
  reason?: string;
  /** Open a refill task: the miss was a supply problem, not a memory problem. */
  refill?: boolean;
  /** Hand the alert to the next link now. */
  pass?: boolean;
  /** Keep the claim open; the dose will be marked when it's taken. */
  later?: boolean;
}

export const DOSE_OUTCOMES: DoseOutcome[] = [
  { id: "taken", label: (f) => `${f} took it`, dose: "taken" },
  { id: "later", label: (f) => `${f} is taking it a little later`, later: true },
  { id: "unwell", label: (f) => `${f} feels unwell, skipping it`, dose: "skipped", reason: "Felt unwell" },
  { id: "ran_out", label: () => "The medicine has run out", dose: "skipped", reason: "Ran out", refill: true },
  { id: "unreachable", label: (f) => `I couldn’t reach ${f}`, pass: true },
];

export const doseOutcome = (id: string): DoseOutcome | null => DOSE_OUTCOMES.find((o) => o.id === id) ?? null;
