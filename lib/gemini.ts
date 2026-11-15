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

export interface GeminiModel {
  name: string;
  supportedGenerationMethods?: string[];
}

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_TIMEOUT_MS = 8000;
// Runs after the response is sent (see setAway); a lite model answers in about a second.
const GENERATE_TIMEOUT_MS = 20_000;

/** A plain-text Flash model from the key's model list ("models/gemini-3-flash" → "gemini-3-flash"). */
export function chooseFlashModel(models: GeminiModel[]): string | null {
  const usable = models.filter(
    // Stable names only: moving aliases ("-latest") and previews can stall or disappear.
    (m) => m.supportedGenerationMethods?.includes("generateContent") && /flash/.test(m.name) && !/(image|tts|audio|live|exp|latest|preview)/.test(m.name),
  );
  return usable.sort((a, b) => b.name.localeCompare(a.name))[0]?.name.replace(/^models\//, "") ?? null;
}

async function listModels(key: string): Promise<GeminiModel[]> {
  const res = await fetch(`${GEMINI_API}/models?pageSize=200`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS) });
  return res.ok ? (((await res.json()) as { models?: GeminiModel[] }).models ?? []) : [];
}

/** `lean` asks the model to skip extended thinking: a short restatement doesn't need it and it is much faster. */
function generate(key: string, model: string, prompt: string, lean: boolean): Promise<Response> {
  return fetch(`${GEMINI_API}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // Generous budget: on thinking models the reasoning counts against it, and the prompt caps the answer at ~110 words.
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048, ...(lean ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
    }),
    signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
  });
}

// Model names change over time; remember the one that worked for this server instance.
let workingModel: string | null = null;

/** Briefing text, and whether Gemini wrote it. Never throws: a failed call falls back to plain text. */
export async function handoffBriefing(i: HandoffInput): Promise<{ text: string; ai: boolean }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { text: handoffFallback(i), ai: false };
  let model = workingModel ?? process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
  try {
    const prompt = handoffPrompt(i);
    let res = await generate(key, model, prompt, true);
    if (res.status === 404) {
      const found = chooseFlashModel(await listModels(key));
      if (found) {
        model = found;
        res = await generate(key, model, prompt, true);
      }
    }
    // Some models refuse a zero thinking budget; ask again with defaults.
    if (res.status === 400) res = await generate(key, model, prompt, false);
    if (!res.ok) throw new Error(`Gemini returned ${res.status} for ${model}`);
    workingModel = model;
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    return text ? { text, ai: true } : { text: handoffFallback(i), ai: false };
  } catch (err) {
    console.error(`[gemini] handoff briefing failed (${model}):`, err instanceof Error ? err.message : "unknown error");
    return { text: handoffFallback(i), ai: false };
  }
}
