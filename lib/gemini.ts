// Gemini writes the handoff briefing for the person covering. It only restates structured facts Dor already
// holds; it never decides anything (ownership, escalation and medicine checks stay deterministic).
// Data minimisation: only the elder's first name, medicine names/times and open items are sent.

export interface HandoffInput {
  elderFirst: string;
  from: string;
  to: string;
  range: string;
  /** Open care events moving to the cover. */
  items: string[];
  /** "Telma-AM 40/5 mg at 8:00 am, after breakfast". */
  meds: string[];
  /** Recent skip reasons, in the elder's words. */
  recent: string[];
}

const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- none");

export function handoffPrompt(i: HandoffInput): string {
  return `You are writing a short handover note inside a family care-coordination app.
${i.from} is away ${i.range}. ${i.to} is covering ${i.elderFirst}'s care.
Write 3 to 5 plain sentences addressed to ${i.to}: what is now theirs, the daily medicine routine, and anything recent to keep an eye on.
Rules: only restate the facts below. Do not give medical advice. Do not diagnose. Do not suggest changing, stopping or adding any medicine. No headings, no lists, under 110 words.

Now ${i.to}'s:
${list(i.items)}

Daily medicines:
${list(i.meds)}

Recent notes from the family log:
${list(i.recent)}`;
}

/** Deterministic briefing used when Gemini isn't configured or doesn't answer. */
export function handoffFallback(i: HandoffInput): string {
  const items = i.items.length ? `Now yours: ${i.items.join("; ")}.` : "Nothing is open right now.";
  const meds = i.meds.length ? `${i.elderFirst}'s daily medicines: ${i.meds.join("; ")}.` : "";
  const recent = i.recent.length ? `Recently noted: ${i.recent.join("; ")}.` : "";
  return [`${i.to}, you're covering ${i.elderFirst}'s care while ${i.from} is away ${i.range}.`, items, meds, recent].filter(Boolean).join(" ");
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

const GEMINI_TIMEOUT_MS = 8000;

/** Briefing text, and whether Gemini wrote it. Never throws: a failed call falls back to plain text. */
export async function handoffBriefing(i: HandoffInput): Promise<{ text: string; ai: boolean }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { text: handoffFallback(i), ai: false };
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: handoffPrompt(i) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Gemini returned ${res.status}`);
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    return text ? { text, ai: true } : { text: handoffFallback(i), ai: false };
  } catch (err) {
    console.error("[gemini] handoff briefing failed:", err instanceof Error ? err.message : "unknown error");
    return { text: handoffFallback(i), ai: false };
  }
}
