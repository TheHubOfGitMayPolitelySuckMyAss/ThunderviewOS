import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

const MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_CHARS = 60;

const INTRO_PROMPT = `Compress this person's intro into a 3-7 word summary for a community directory. The reader sees their Name and Company in adjacent columns.

Rules:
- Don't repeat the company name.
- Drop greetings, role titles, bio padding ("I'm ___", "founder of", "CEO of", "I am").
- If the intro covers multiple ventures or accomplishments, pick the single most distinctive one. Don't list "X + Y."
- Match the original's specificity. If the original is vague, the summary stays vague. Don't invent details to seem concrete.
- No period at the end.

Intro: {text}

Output only the summary, no quotes, no explanation.`;

const ASK_PROMPT = `Compress this person's "ask" into a 3-7 word summary for a community directory. A reader scanning the column decides whether they can help.

Rules:
- Drop softeners ("looking for", "I'd love", "if anyone knows", "always looking", "interested in connecting with").
- If they ask for several distinct things, pick the most concrete one. Don't list "X + Y."
- Don't repeat the company name (adjacent column).
- Match original specificity. If the ask is genuinely "community" or "be excellent to each other" or "just moved, looking for connections" — keep it. Vague asks are valid asks.
- No period at the end.

Ask: {text}

Output only the summary, no quotes, no explanation.`;

const GIVE_PROMPT = `Compress this person's "give" into a 3-7 word summary for a community directory. A reader scanning the column decides whether to reach out.

Rules:
- Drop softeners ("happy to", "always open", "feel free", "love being", "glad to").
- If they offer multiple things, pick the single most concrete or distinctive one. Don't list "X + Y."
- Preserve concrete units when present ("1hr review", "30-min chat", "open office hours every Tuesday").
- Match original specificity.
- No period at the end.

Give: {text}

Output only the summary, no quotes, no explanation.`;

async function summarize(prompt: string, text: string): Promise<string | null> {
  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 100,
      messages: [{ role: "user", content: prompt.replace("{text}", text) }],
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    const out = block.text.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/\.$/, "");
    return out.length > MAX_OUTPUT_CHARS ? out.slice(0, MAX_OUTPUT_CHARS) : out || null;
  } catch (err) {
    console.error("[summarize-profile] API call failed:", err);
    return null;
  }
}

export async function summarizeIntro(text: string) {
  return summarize(INTRO_PROMPT, text);
}

export async function summarizeAsk(text: string) {
  return summarize(ASK_PROMPT, text);
}

export async function summarizeGive(text: string) {
  return summarize(GIVE_PROMPT, text);
}

export type ChangedFields = {
  intro?: string | null;
  ask?: string | null;
  give?: string | null;
};

export type SummarizedFields = {
  current_intro_short?: string | null;
  current_ask_short?: string | null;
  current_give_short?: string | null;
};

/**
 * Generate shorts for any fields that were passed in. Empty/null source text
 * → null short. API failure → key omitted entirely so the caller's UPDATE
 * leaves the column alone (preserving the prior short rather than nulling it).
 */
export async function summarizeChangedFields(
  changed: ChangedFields,
): Promise<SummarizedFields> {
  const results: SummarizedFields = {};
  const tasks: Promise<void>[] = [];

  if (changed.intro !== undefined) {
    tasks.push(
      (async () => {
        if (!changed.intro) {
          results.current_intro_short = null;
        } else {
          const s = await summarizeIntro(changed.intro);
          if (s !== null) results.current_intro_short = s;
        }
      })(),
    );
  }
  if (changed.ask !== undefined) {
    tasks.push(
      (async () => {
        if (!changed.ask) {
          results.current_ask_short = null;
        } else {
          const s = await summarizeAsk(changed.ask);
          if (s !== null) results.current_ask_short = s;
        }
      })(),
    );
  }
  if (changed.give !== undefined) {
    tasks.push(
      (async () => {
        if (!changed.give) {
          results.current_give_short = null;
        } else {
          const s = await summarizeGive(changed.give);
          if (s !== null) results.current_give_short = s;
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return results;
}
