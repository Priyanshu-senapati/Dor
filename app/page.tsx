import { createProfile, enterDemo, joinProfile } from "./actions";
import { Card, Flash, Kite, field, label, primary, secondary, type FlashParams } from "@/components/ui";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { Submit } from "@/components/Submit";

function HoldPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-4 -z-10 rotate-2 rounded-3xl bg-kite/15" />
      {/* The one authored motion on the site: the alert travels down the chain, in order. */}
      <ol className="space-y-3">
        <li className="reveal rounded-2xl border border-line bg-white p-4 shadow-sm" style={{ animationDelay: "150ms" }}>
          <p className="text-sm font-bold tabular-nums text-warn">8:31 AM · Missed dose</p>
          <p className="mt-1 text-lg font-bold">Amma hasn’t marked Telma-AM 40</p>
          <p className="text-muted">Asked Amma first. No answer.</p>
        </li>
        <li className="reveal ml-6 rounded-2xl border border-line bg-white p-4 shadow-sm" style={{ animationDelay: "900ms" }}>
          <p className="text-sm font-bold tabular-nums text-sky">8:46 AM · Passed to Riya</p>
          <p className="mt-1 font-bold">“You’re up. If nobody answers in 15 min, it goes to Arjun.”</p>
          <span className="mt-2 inline-block rounded-lg bg-kite-deep px-3 py-1.5 font-bold text-white">I’m on it</span>
        </li>
        <li className="reveal ml-12 rounded-2xl border border-leaf/30 bg-[#eef6f1] p-4 shadow-sm" style={{ animationDelay: "1650ms" }}>
          <p className="flex items-center gap-1.5 text-sm font-bold tabular-nums text-leaf">
            <CheckIcon className="h-4 w-4" /> 8:47 AM · Handled
          </p>
          <p className="mt-1 font-bold">Everyone sees: Riya is handling it.</p>
          <p className="text-muted">Arjun doesn’t panic. Nobody assumes.</p>
        </li>
      </ol>
    </div>
  );
}

const DOT = { asked: "bg-warn", owner: "bg-leaf", told: "bg-sky" } as const;

/** Hold: the chain drawn as a kite string, one owner highlighted. */
function ChainArtifact() {
  const links = [
    { who: "Kamala Devi", note: "Asked first: “Did you take it?”", state: "asked" },
    { who: "Riya", note: "Tapped “I’m on it” at 8:47", state: "owner" },
    { who: "Arjun", note: "Told Riya has it. No action needed.", state: "told" },
  ] as const;
  return (
    <ol className="relative space-y-3 pl-9">
      <svg aria-hidden="true" className="absolute left-2 top-4 h-[calc(100%-2rem)] w-5" viewBox="0 0 20 100" preserveAspectRatio="none">
        <path d="M10 0 C 2 20, 18 40, 10 55 S 4 85, 10 100" fill="none" stroke="#1f2a44" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      {links.map((l) => (
        <li key={l.who} className={`relative rounded-2xl border p-3.5 ${l.state === "owner" ? "border-leaf/40 bg-[#eef6f1]" : "border-line bg-white"}`}>
          <span aria-hidden="true" className={`absolute -left-[1.85rem] top-4 h-3.5 w-3.5 rounded-full ring-4 ring-white ${DOT[l.state]}`} />
          <p className="font-bold">{l.who}</p>
          <p className="text-muted">{l.note}</p>
        </li>
      ))}
    </ol>
  );
}

/** Check: the real warning the medicine form shows while you type. */
function CheckArtifact() {
  return (
    <div>
      <p className="mb-1 text-sm font-bold text-muted">Medicine name, as on the strip</p>
      <div className="flex items-center rounded-xl border-2 border-sky bg-white px-3 py-2.5 text-lg">
        Amlong 5<span aria-hidden="true" className="ml-0.5 h-6 w-0.5 animate-pulse bg-kite-deep" />
      </div>
      <p className="mt-2 text-sm">
        <span className="font-bold text-sky">Contains:</span> amlodipine
      </p>
      <div className="mt-3 rounded-xl border border-alarm/30 bg-alarm/5 p-3">
        <p className="flex items-start gap-2 font-bold text-alarm">
          <AlertIcon className="mt-0.5 h-5 w-5" /> amlodipine is already in Telma-AM (Dr Meera Sharma, Cardiology).
        </p>
        <p className="mt-1 text-sm text-muted">Taking both may double the dose. Check with the doctor or pharmacist first.</p>
      </div>
    </div>
  );
}

/** Trace: how she felt, lined up against what changed. */
function TraceArtifact() {
  const rows = [
    { day: "3 Nov", tag: "Medicine", tone: "bg-sky/10 text-sky", text: "Telma 40 mg → Telma-AM 40/5 mg", bold: true },
    { day: "5 Nov", tag: "Felt", tone: "bg-warn/10 text-warn", text: "Dizziness when standing up" },
    { day: "9 Nov", tag: "Felt", tone: "bg-warn/10 text-warn", text: "Swollen feet in the evening" },
  ];
  return (
    <div>
      <ul className="space-y-2.5 border-l-2 border-line pl-4">
        {rows.map((r) => (
          <li key={r.day + r.text} className="flex flex-wrap items-baseline gap-2">
            <span className="w-14 text-sm tabular-nums text-muted">{r.day}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.tone}`}>{r.tag}</span>
            <span className={r.bold ? "font-bold" : ""}>{r.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl border border-kite/40 bg-[#fff7f0] p-3">
        <p className="font-bold">Dizziness started 2 days after the Telma-AM change.</p>
        <p className="text-sm text-muted">Added to the Doctor Brief for Monday’s visit.</p>
      </div>
    </div>
  );
}

const ROWS = [
  {
    name: "Hold",
    line: "One owner for every moment",
    text: "A missed dose, an empty strip, a doctor visit with nobody to take her. Each goes to one person, who taps “I’m on it”. If they don’t, it passes down the chain every 15 minutes, and the moment someone answers, everyone else is told.",
    artifact: <ChainArtifact />,
  },
  {
    name: "Check",
    line: "Same salt, different brand",
    text: "Elders see three or four doctors, and each writes brand names. Telma-AM already contains amlodipine; add Amlong from another doctor and Dor flags the double dose while you type, naming both prescribers.",
    artifact: <CheckArtifact />,
  },
  {
    name: "Trace",
    line: "What changed before she felt unwell",
    text: "Symptoms, and the reasons she gives for skipping, line up against every medicine change. Dor doesn’t diagnose. It shows the timing, on a one-page Doctor Brief the family can print.",
    artifact: <TraceArtifact />,
  },
];

export default async function Home({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <Kite className="h-10 w-10" />
          <span className="font-display text-3xl">Dor</span>
          <span lang="hi" className="font-display mt-1 text-xl text-muted">डोर</span>
        </div>
        <a href="#join" className={secondary}>
          Join a circle
        </a>
      </header>

      <Flash ok={sp.ok} error={sp.error} />

      <section className="grid gap-12 py-8 md:grid-cols-[1.15fr_1fr] md:items-center">
        <div>
          <h1 className="font-display text-4xl leading-[1.08] text-balance md:text-6xl">
            Amma flies her own kite. Dor makes sure someone is always holding the string.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            When a reminder app tells the whole family a dose was missed, everyone assumes someone else will call. Dor gives
            every missed dose, refill and doctor visit <strong className="text-ink">one owner</strong>, checks prescriptions
            from different doctors against each other, and keeps the elder in charge of their own medicines.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#demo" className={primary}>
              Try the live demo
            </a>
            <a href="#start" className={secondary}>
              Start a care circle
            </a>
          </div>
        </div>
        <HoldPreview />
      </section>

      <section aria-labelledby="how" className="border-t border-line py-16">
        <h2 id="how" className="font-display max-w-3xl text-3xl leading-tight text-balance md:text-5xl">
          Reminders tell everyone. Dor makes sure someone acts.
        </h2>
        <div className="mt-14 space-y-20">
          {ROWS.map((r, i) => (
            <div key={r.name} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
              <div className={i % 2 ? "md:order-2" : ""}>
                <h3 className="font-display text-4xl">{r.name}</h3>
                <p className="mt-1 text-xl font-bold text-kite-deep">{r.line}</p>
                <p className="mt-4 max-w-prose text-lg text-muted">{r.text}</p>
              </div>
              <div aria-hidden="true" className="rounded-3xl border border-line bg-white p-6 shadow-[0_2px_4px_rgba(31,42,68,0.05),0_24px_48px_-28px_rgba(31,42,68,0.35)]">
                {r.artifact}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Card id="demo" className="mb-10 border-kite/40 bg-[#fff4ea]" title="Step into Kamala Devi’s circle">
        <p className="max-w-2xl text-muted">
          Kamala Devi, 74, sees three doctors. Her daughter Riya is her caretaker and her son Arjun lives in Pune. Open her
          circle as either of them. No sign-up needed.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={enterDemo}>
            <input type="hidden" name="role" value="caretaker" />
            <Submit className={primary} pending="Opening…">Enter as Riya (caretaker)</Submit>
          </form>
          <form action={enterDemo}>
            <input type="hidden" name="role" value="elder" />
            <Submit className={secondary} pending="Opening…">Enter as Kamala (elder mode)</Submit>
          </form>
        </div>
        <p className="mt-4 text-sm text-muted">
          Want the real emails? Join with code <strong className="text-ink">DOR-DEMO</strong> and passcode{" "}
          <strong className="text-ink">2468</strong> using your own email. You’ll join the end of the chain.
        </p>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card id="start" title="Start a care circle">
          <form action={createProfile} className="space-y-3">
            <div>
              <label className={label} htmlFor="elderName">Who is this circle for?</label>
              <input id="elderName" name="elderName" required maxLength={60} placeholder="e.g. Kamala Devi" className={field} />
            </div>
            <div>
              <label className={label} htmlFor="role">You are</label>
              <select id="role" name="role" className={field} defaultValue="caretaker">
                <option value="caretaker">Their caretaker</option>
                <option value="family">Family</option>
                <option value="elder">The elder (this circle is for me)</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="name">Your name</label>
                <input id="name" name="name" maxLength={60} placeholder="Skip if you are the elder" className={field} />
              </div>
              <div>
                <label className={label} htmlFor="email">Your email</label>
                <input id="email" name="email" type="email" required maxLength={120} className={field} />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="elderEmail">Their email (optional, so Dor asks them first)</label>
              <input id="elderEmail" name="elderEmail" type="email" maxLength={120} className={field} />
            </div>
            <div>
              <label className={label} htmlFor="passcode">Choose a passcode to share with family</label>
              <input id="passcode" name="passcode" type="password" required minLength={4} maxLength={32} autoComplete="new-password" className={field} />
            </div>
            <Submit className={`${primary} w-full`} pending="Creating…">Create the circle</Submit>
          </form>
        </Card>

        <Card id="join" title="Join a circle">
          <form action={joinProfile} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="code">Circle code</label>
                <input id="code" name="code" required maxLength={20} placeholder="DOR-XXXX" className={`${field} uppercase`} />
              </div>
              <div>
                <label className={label} htmlFor="jpasscode">Passcode</label>
                <input id="jpasscode" name="passcode" type="password" required maxLength={32} autoComplete="current-password" className={field} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="jname">Your name</label>
                <input id="jname" name="name" required maxLength={60} className={field} />
              </div>
              <div>
                <label className={label} htmlFor="jemail">Your email</label>
                <input id="jemail" name="email" type="email" required maxLength={120} className={field} />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="jrole">You are</label>
              <select id="jrole" name="role" className={field} defaultValue="family">
                <option value="family">Family</option>
                <option value="caretaker">Caretaker</option>
                <option value="elder">The elder</option>
              </select>
            </div>
            <Submit className={`${secondary} w-full`} pending="Checking…">Join</Submit>
          </form>
        </Card>
      </div>

      <footer className="mt-12 border-t border-line pt-6 text-sm text-muted">
        Dor helps a family coordinate. It is not medical advice. Always check medicine changes with a doctor or pharmacist.
      </footer>
    </main>
  );
}
