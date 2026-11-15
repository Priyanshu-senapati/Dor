export type Role = "elder" | "caretaker" | "family";

export interface Profile {
  id: string;
  code: string;
  elder_name: string;
}

export interface Member {
  id: string;
  profile_id: string;
  name: string;
  email: string;
  role: Role;
  chain_order: number;
}

export interface Med {
  id: string;
  profile_id: string;
  brand: string;
  salts: string[];
  dose: string;
  times: string[];
  start_date: string;
  end_date: string | null;
  instructions: string;
  pills_left: number | null;
  pills_per_dose: number;
  prescribed_by: string;
  prescribed_on: string | null;
  status: "active" | "pending" | "declined" | "stopped";
  created_by: string | null;
  replaces_id: string | null;
  created_at: Date;
}

export interface DoseLog {
  med_id: string;
  at: Date;
  status: "taken" | "skipped" | "missed";
  reason: string;
  marked_by: string | null;
}

export interface Appointment {
  id: string;
  profile_id: string;
  doctor: string;
  specialty: string;
  location: string;
  starts_at: Date;
  purpose: string;
  questions: string;
  escort_id: string | null;
}

export interface Alert {
  id: string;
  profile_id: string;
  kind: "dose" | "refill" | "escort";
  ref_key: string;
  title: string;
  body: string;
  status: "open" | "acked" | "resolved";
  level: number;
  owner_id: string | null;
  last_notified_at: Date;
  acked_by: string | null;
  acked_at: Date | null;
  resolution: string;
  created_at: Date;
}

export interface EventRow {
  id: string;
  member_id: string | null;
  kind: string;
  label: string;
  at: Date;
}

export interface SymptomRow {
  id: string;
  member_id: string | null;
  name: string;
  note: string;
  at: Date;
}

/** Payload of a one-click email link. */
export interface EmailAction {
  a: "ack" | "taken" | "skip";
  m: string;
  p: string;
  id?: string;
  med?: string;
  at?: number;
}
