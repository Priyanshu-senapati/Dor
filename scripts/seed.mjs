// Seeds the public demo circle (code DOR-DEMO, passcode 2468). Re-running replaces it.
// Usage: node --env-file=.env.local scripts/seed.mjs   (needs DATABASE_URL and DEMO_EMAIL)
import { randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const demoEmail = process.env.DEMO_EMAIL;
if (!url || !demoEmail?.includes("@")) throw new Error("Set DATABASE_URL and DEMO_EMAIL");
const sql = neon(url);

const DAY = 86_400_000;
const now = new Date();
const istDate = (d) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
const day = (offset) => istDate(new Date(now.getTime() + offset * DAY));
const at = (offset, hhmm) => new Date(`${day(offset)}T${hhmm}:00+05:30`);
const tag = (t) => demoEmail.replace("@", `+${t}@`);
const hash = (p) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(p, salt, 32).toString("hex")}`;
};

await sql`delete from profiles where code = 'DOR-DEMO'`;
const [{ id: pid }] = await sql`insert into profiles (code, elder_name, passcode_hash)
  values ('DOR-DEMO', 'Kamala Devi', ${hash("2468")}) returning id`;

const member = async (name, t, role, order) =>
  (await sql`insert into members (profile_id, name, email, role, chain_order)
    values (${pid}, ${name}, ${tag(t)}, ${role}, ${order}) returning id`)[0].id;
const kamala = await member("Kamala Devi", "kamala", "elder", 0);
const riya = await member("Riya", "riya", "caretaker", 1);
const arjun = await member("Arjun", "arjun", "family", 2);

const med = async (o) =>
  (await sql`insert into medications (profile_id, brand, salts, dose, times, start_date, end_date, instructions,
      pills_left, prescribed_by, prescribed_on, status, created_by, replaces_id, created_at)
    values (${pid}, ${o.brand}, ${o.salts}, ${o.dose}, ${o.times}, ${o.start}, ${o.end ?? null}, ${o.instructions ?? ""},
      ${o.pillsLeft ?? null}, ${o.by}, ${o.on}, ${o.status ?? "active"}, ${o.createdBy ?? kamala}, ${o.replaces ?? null},
      ${o.createdAt}) returning id`)[0].id;

const iyer = "Dr Anand Iyer (Diabetology)";
const sharma = "Dr Meera Sharma (Cardiology)";
const glycomet = await med({ brand: "Glycomet-GP 1", salts: ["metformin", "glimepiride"], dose: "", times: ["08:00", "20:00"],
  start: day(-60), instructions: "after food", pillsLeft: 46, by: iyer, on: day(-61), createdAt: at(-60, "07:00") });
const thyronorm = await med({ brand: "Thyronorm", salts: ["levothyroxine"], dose: "50 mcg", times: ["06:30"],
  start: day(-60), instructions: "empty stomach, before tea", pillsLeft: 2, by: iyer, on: day(-61), createdAt: at(-60, "06:00") });
const shelcal = await med({ brand: "Shelcal", salts: ["calcium carbonate", "cholecalciferol"], dose: "500 mg", times: ["21:00"],
  start: day(-60), instructions: "after dinner", pillsLeft: 52, by: iyer, on: day(-61), createdAt: at(-60, "07:00") });
const ecosprin = await med({ brand: "Ecosprin", salts: ["aspirin"], dose: "75 mg", times: ["14:00"],
  start: day(-45), instructions: "after lunch", pillsLeft: 40, by: sharma, on: day(-46), createdAt: at(-45, "09:00") });
const telma = await med({ brand: "Telma", salts: ["telmisartan"], dose: "40 mg", times: ["08:00"], start: day(-45), end: day(-13),
  status: "stopped", instructions: "after breakfast", by: sharma, on: day(-46), createdAt: at(-45, "07:00") });
const telmaAm = await med({ brand: "Telma-AM", salts: ["telmisartan", "amlodipine"], dose: "40/5 mg", times: ["08:00"],
  start: day(-12), instructions: "after breakfast", pillsLeft: 18, by: sharma, on: day(-12), replaces: telma,
  createdAt: at(-12, "07:00") });
await med({ brand: "Amlong", salts: ["amlodipine"], dose: "5 mg", times: ["21:00"], start: day(0), status: "pending",
  instructions: "after dinner", pillsLeft: 30, by: "Dr Rao (General Physician)", on: day(-2), createdBy: riya,
  createdAt: at(-1, "19:00") });

const events = [
  [at(-60, "10:00"), kamala, "circle", "Riya started Kamala Devi's care circle"],
  [at(-60, "10:05"), kamala, "med_start", "Started Glycomet-GP 1"],
  [at(-60, "10:06"), kamala, "med_start", "Started Thyronorm 50 mcg"],
  [at(-60, "10:07"), kamala, "med_start", "Started Shelcal 500 mg"],
  [at(-45, "12:00"), kamala, "med_start", "Started Telma 40 mg"],
  [at(-45, "12:01"), kamala, "med_start", "Started Ecosprin 75 mg"],
  [at(-12, "11:00"), kamala, "med_change", "Telma 40 mg → Telma-AM 40/5 mg"],
  [at(-5, "18:00"), riya, "appointment", "Riya booked Dr Meera Sharma for tomorrow's BP review"],
  [at(-1, "19:00"), riya, "proposal", "Riya proposed adding Amlong 5 mg"],
  [at(-1, "20:47"), riya, "ack", "Riya is handling: Kamala Devi hasn't marked Glycomet-GP 1 (8:00 pm)"],
];

const symptoms = [
  [at(-25, "15:00"), riya, "headache", "after the long bus ride"],
  [at(-10, "09:30"), kamala, "dizziness", "when standing up from the chair"],
  [at(-8, "10:00"), riya, "dizziness", "had to sit down in the kitchen"],
  [at(-6, "18:00"), riya, "swollen feet", "ankles puffy in the evening"],
  [at(-2, "20:00"), arjun, "swollen feet", "she mentioned it on the video call"],
];

const skips = new Map([
  [`${telmaAm}:-9`, "Felt dizzy"],
  [`${telmaAm}:-4`, "Felt dizzy"],
  [`${ecosprin}:-7`, "Stomach upset"],
]);
const missed = new Set([`${glycomet}:20:00:-7`, `${glycomet}:20:00:-3`]);

const schedule = [
  [glycomet, ["08:00", "20:00"], -60, null],
  [thyronorm, ["06:30"], -60, null],
  [shelcal, ["21:00"], -60, null],
  [ecosprin, ["14:00"], -45, null],
  [telma, ["08:00"], -45, -13],
  [telmaAm, ["08:00"], -12, null],
];

const logs = [];
for (let d = -14; d <= 0; d++) {
  for (const [id, times, from, to] of schedule) {
    if (d < from || (to !== null && d > to)) continue;
    for (const t of times) {
      const when = at(d, t);
      if (when.getTime() > now.getTime() - 45 * 60_000) continue; // leave recent and future doses for the live demo
      if (d === 0 && id === telmaAm) continue; // today's Telma-AM stays unmarked → live Hold alert
      const reason = skips.get(`${id}:${d}`);
      const status = reason ? "skipped" : missed.has(`${id}:${t}:${d}`) ? "missed" : "taken";
      const by = status === "missed" ? null : d === -1 && t === "20:00" ? riya : kamala;
      logs.push([id, when, status, reason ?? "", by]);
      if (reason) {
        events.push([when, kamala, "skip", `Kamala Devi chose to skip ${id === telmaAm ? "Telma-AM 40/5 mg" : "Ecosprin 75 mg"} (${t}): ${reason}`]);
        if (reason === "Felt dizzy") symptoms.push([when, kamala, "dizziness", `Gave it as the reason to skip Telma-AM`]);
      }
    }
  }
}

await sql.transaction(
  logs.map(([id, when, status, reason, by]) => sql`insert into dose_logs (med_id, profile_id, at, status, reason, marked_by, marked_at)
    values (${id}, ${pid}, ${when}, ${status}, ${reason}, ${by}, ${when})`),
);
await sql.transaction(
  events.map(([when, by, kind, label]) => sql`insert into events (profile_id, member_id, kind, label, at)
    values (${pid}, ${by}, ${kind}, ${label}, ${when})`),
);
await sql.transaction(
  symptoms.map(([when, by, name, note]) => sql`insert into symptoms (profile_id, member_id, name, note, at)
    values (${pid}, ${by}, ${name}, ${note}, ${when})`),
);

await sql`insert into appointments (profile_id, doctor, specialty, location, starts_at, purpose, questions, escort_id) values
  (${pid}, 'Dr Anand Iyer', 'Diabetology', 'Sugar Care Clinic, Jayanagar', ${at(-20, "10:00")}, 'Quarterly sugar review', '', ${riya}),
  (${pid}, 'Dr Meera Sharma', 'Cardiology', 'Heart Care Clinic, Basavanagudi', ${at(-12, "10:00")}, 'BP high at home', '', ${riya}),
  (${pid}, 'Dr Meera Sharma', 'Cardiology', 'Heart Care Clinic, Basavanagudi', ${at(1, "11:00")}, 'BP review after the Telma-AM change',
   ${"Riya: Is the dizziness from the new BP tablet?\nArjun: Dr Rao also prescribed Amlong. Is that safe with Telma-AM?\nKamala Devi: Can I take fewer tablets at night?"}, null)`;

const lateAt = at(-1, "20:00");
await sql`insert into alerts (profile_id, kind, ref_key, title, body, status, level, owner_id, last_notified_at, acked_by, acked_at, resolution, created_at)
  values (${pid}, 'dose', ${`dose:${glycomet}:${lateAt.getTime()}`}, 'Kamala Devi hasn''t marked Glycomet-GP 1 (8:00 pm)',
    'The 8:00 pm dose of Glycomet-GP 1 is over 30 minutes late and nobody has marked it.', 'resolved', 1, ${riya},
    ${at(-1, "20:45")}, ${riya}, ${at(-1, "20:47")}, 'Riya called. Kamala Devi took Glycomet-GP 1 at 9:10 pm (marked by Riya)', ${at(-1, "20:31")})`;

console.log(`Seeded DOR-DEMO: ${logs.length} dose logs, ${events.length} events, ${symptoms.length} symptoms.`);
