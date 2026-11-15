export const SYMPTOMS = [
  "dizziness",
  "swollen feet",
  "nausea",
  "drowsiness",
  "headache",
  "stomach upset",
  "low sugar",
  "breathlessness",
  "cough",
  "fatigue",
] as const;

/** Why a dose was skipped; reasons that are symptoms also feed the Trace timeline. */
export const SKIP_REASONS: { label: string; symptom: string | null }[] = [
  { label: "Felt dizzy", symptom: "dizziness" },
  { label: "Felt sick", symptom: "nausea" },
  { label: "Felt unwell", symptom: "feeling unwell" },
  { label: "Too sleepy", symptom: "drowsiness" },
  { label: "Stomach upset", symptom: "stomach upset" },
  { label: "Ran out", symptom: null },
  { label: "Didn't want to", symptom: null },
  { label: "Doctor said to stop", symptom: null },
];
