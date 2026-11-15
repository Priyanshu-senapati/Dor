import { createProfile, enterDemo, joinProfile } from "./actions";
import { Card, Flash, Kite, field, label, primary, secondary, type FlashParams } from "@/components/ui";

function HoldPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-4 -z-10 rotate-2 rounded-3xl bg-kite/15" />
      <ol className="space-y-3">
        <li className="rounded-2xl border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-warn">8:31 AM · Missed dose</p>
          <p className="mt-1 text-lg font-bold">Amma hasn’t marked Telma-AM 40</p>
          <p className="text-muted">Asked Amma first. No answer.</p>
        </li>
        <li className="ml-6 rounded-2xl border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-sky">8:46 AM · Passed to Riya</p>
          <p className="mt-1 font-bold">“You’re up. If nobody answers in 15 min, it goes to Arjun.”</p>
          <span className="mt-2 inline-block rounded-lg bg-kite-deep px-3 py-1.5 font-bold text-white">I’m on it</span>
        </li>
        <li className="ml-12 rounded-2xl border-l-4 border-leaf bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-leaf">8:47 AM · Handled</p>
          <p className="mt-1 font-bold">Everyone sees: Riya is handling it.</p>
          <p className="text-muted">Arjun doesn’t panic. Nobody assumes.</p>
        </li>
      </ol>
    </div>
  );
}

const PILLARS = [
  {
    name: "Hold",
    line: "One owner for every moment",
    text: "A missed dose, an empty strip, a doctor visit with nobody to take her. Each goes to one person, who taps “I’m on it”. If they don’t, it passes down the chain every 15 minutes.",
  },
  {
    name: "Check",
    line: "Same salt, different brand",
    text: "Telma-AM already contains amlodipine. Add Amlong from another doctor and Dor flags the double dose, naming both prescribers, before it reaches the pill box.",
  },
  {
    name: "Trace",
    line: "What changed before she felt unwell",
    text: "Symptoms and skip reasons line up against medicine changes. “Dizziness began 2 days after the dose went up” lands on a one-page Doctor Brief.",
  },
];

export default async function Home({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <Kite className="h-10 w-10" />
          <span className="font-display text-3xl font-semibold">Dor</span>
        </div>
        <a href="#join" className={secondary}>
          Join a circle
        </a>
      </header>

      <Flash ok={sp.ok} error={sp.error} />

      <section className="grid gap-12 py-8 md:grid-cols-[1.15fr_1fr] md:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-kite-deep">Dor (डोर) · the string of a kite</p>
          <h1 className="font-display mt-3 text-4xl leading-[1.08] md:text-6xl">
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

      <section aria-label="How Dor works" className="grid gap-4 py-10 md:grid-cols-3">
        {PILLARS.map((p) => (
          <Card key={p.name} eyebrow={p.name} title={p.line}>
            <p className="text-muted">{p.text}</p>
          </Card>
        ))}
      </section>

      <Card id="demo" className="mb-10 border-kite/40 bg-[#fff4ea]" eyebrow="Live demo" title="Step into Kamala Devi’s circle">
        <p className="max-w-2xl text-muted">
          Kamala Devi, 74, sees three doctors. Her daughter Riya is her caretaker and her son Arjun lives in Pune. Open her
          circle as either of them. No sign-up needed.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={enterDemo}>
            <input type="hidden" name="role" value="caretaker" />
            <button className={primary}>Enter as Riya (caretaker)</button>
          </form>
          <form action={enterDemo}>
            <input type="hidden" name="role" value="elder" />
            <button className={secondary}>Enter as Kamala (elder mode)</button>
          </form>
        </div>
        <p className="mt-4 text-sm text-muted">
          Want the real emails? Join with code <strong className="text-ink">DOR-DEMO</strong> and passcode{" "}
          <strong className="text-ink">2468</strong> using your own email. You’ll join the end of the chain.
        </p>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card id="start" eyebrow="New" title="Start a care circle">
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
            <button className={`${primary} w-full`}>Create the circle</button>
          </form>
        </Card>

        <Card id="join" eyebrow="Family" title="Join a circle">
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
            <button className={`${secondary} w-full`}>Join</button>
          </form>
        </Card>
      </div>

      <footer className="mt-12 border-t border-line pt-6 text-sm text-muted">
        Dor helps a family coordinate. It is not medical advice. Always check medicine changes with a doctor or pharmacist.
      </footer>
    </main>
  );
}
