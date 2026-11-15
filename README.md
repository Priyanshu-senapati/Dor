# Dor (डोर)

**Amma flies her own kite. Dor makes sure someone is always holding the string.**

Live: **https://dor-sandy-two.vercel.app** · Demo: press **Enter as Riya** or **Enter as Kamala** on the home page (or join code `DOR-DEMO`, passcode `2468`, with your own email to receive the real alerts).

---

## The problem behind the problem

Medication reminder apps already exist. Family dashboards already exist. What still goes wrong is simpler:

- **Nobody owns the alert.** When a missed-dose notification goes to four siblings, each assumes someone else called Amma.
- **Nobody sees the whole prescription list.** Elders see three or four doctors. Telma-AM already contains amlodipine; add Amlong from another doctor and she takes it twice.
- **Nobody connects how she feels to what changed.** "She's been dizzy" reaches the doctor without "since the dose went up".
- **Care becomes surveillance.** The elder is reduced to a red "MISSED" on someone else's phone.

Dor is built around one question: **when something needs attention, who is responsible for what happens next?**

## What Dor does

| | |
|---|---|
| **Hold**: one owner per moment | A missed dose goes to the elder first ("Did you take it?"). Unanswered after 15 minutes, it passes to the next person in the chain, then the next. The first person to tap **I'm on it** (in the app or straight from the email) owns it, and everyone else is told *"Riya is handling it"*. Refills ("who's buying more?") and doctor visits ("who's taking Amma?") work the same way. |
| **Check**: same salt, different brand | ~150 common Indian brands (including combinations like Telma-AM, Glycomet-GP, Ecosprin-AV) map to their active ingredients. Dor warns *while you type* and lists every duplicate with each prescribing doctor and date. |
| **Trace**: what changed before she felt unwell | Symptoms, and the reasons she gives for skipping, are lined up against every medicine change. "Dizziness started 2 days after Telma 40 mg → Telma-AM 40/5 mg" is flagged and goes on the **Doctor Brief**, a one-page printable summary for the next visit. |
| **The elder stays in charge** | Changes suggested by family stay *pending* until the elder approves them. "I chose to skip, felt dizzy" is a valid answer, shown neutrally with her reason, not as a failure. **Elder mode** is one big next-dose card with two buttons and read-aloud, set in Atkinson Hyperlegible (designed for low vision). |

### Problem-statement checklist

| Requirement | Where |
|---|---|
| Shared profile with passcode-based access | Start / Join a circle (code + passcode, scrypt-hashed, 5 tries then a 10-minute lock) |
| View, add, edit and manage medication schedules | Medicines page (change = new version, approved by the elder) |
| Track adherence | Today (7-day %), per medicine, and 30-day table on the Doctor Brief |
| Upcoming doctor appointments | Appointments page, escort claiming, questions for the doctor |
| Email reminders: upcoming doses, missed doses, appointments | 5-minute check: dose reminders, missed-dose alerts with escalation, 24 h and 2 h visit reminders, refill alerts. Every email has one-tap actions. |
| Elder at the centre of their own decisions | Elder approves changes, elder is asked first, skip with a reason, elder mode |

## How it works

- **Next.js 15** (App Router, server components and server actions) on **Vercel**
- **Postgres on Neon**, queried with parameterised tagged templates (`lib/db.ts`, schema in `db/schema.sql`)
- **Email** via Gmail SMTP (`lib/mail.ts`), with per-recipient and daily caps so the sender stays in good standing
- **The check** (`lib/tick.ts`) runs every 5 minutes from a GitHub Actions workflow (`.github/workflows/tick.yml`), because Vercel's free plan only allows a daily cron. It is idempotent: overlapping runs never send an email or raise an alert twice.
- **One-tap email links** are signed, expire in 24 hours, and only act on POST, so mail scanners that pre-open links can't press buttons.
- Core logic is pure and unit-tested: `lib/schedule.ts`, `lib/chain.ts`, `lib/salts.ts`, `lib/trace.ts`, `lib/token.ts`, `lib/passcode.ts`.

## Run it locally

```bash
npm install
cp .env.example .env.local      # fill in DATABASE_URL, SESSION_SECRET, CRON_SECRET, SMTP_USER, SMTP_PASS
npm run db:migrate
DEMO_EMAIL=you@gmail.com npm run db:seed   # optional demo circle
npm run dev
npm test
```

## Limits we know about

- Dor coordinates; it is **not medical advice**. The brand list is a curated safety net, not a formulary, so unknown brands ask the family to type the ingredient.
- All circles run on India Standard Time.
- GitHub's scheduler can run a few minutes late; the **Run the reminder check now** button runs it on demand.
