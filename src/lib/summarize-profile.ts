import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

const MODEL = "claude-sonnet-4-6";

type Field = "intro" | "ask" | "give";

const FIELD_LABEL: Record<Field, string> = {
  intro: "Intro",
  ask: "Ask",
  give: "Give",
};

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

const PROMPT_BY_FIELD: Record<Field, string> = {
  intro: INTRO_PROMPT,
  ask: ASK_PROMPT,
  give: GIVE_PROMPT,
};

async function logEvent(
  type: string,
  subjectMemberId: string | null,
  summary: string,
  metadata: Record<string, unknown>,
) {
  try {
    const admin = createAdminClient("system-internal");
    await admin.from("system_events").insert({
      event_type: type,
      subject_member_id: subjectMemberId,
      summary,
      metadata,
    });
  } catch (err) {
    // Don't let a logging failure cascade. Stays in stdout for Vercel logs.
    console.error("[summarize-profile] system_events insert failed:", err);
  }
}

async function summarize(
  field: Field,
  text: string,
  memberId: string,
): Promise<string | null> {
  const prompt = PROMPT_BY_FIELD[field];
  const inputChars = text.length;
  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 100,
      messages: [{ role: "user", content: prompt.replace("{text}", text) }],
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      await logEvent("error.caught", memberId, `Summary returned no text (${field})`, {
        source: "summarize-profile",
        cause: "no_text_block",
        field,
        member_id: memberId,
        model: MODEL,
        input_chars: inputChars,
      });
      return null;
    }
    const out = block.text.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/\.$/, "");
    if (!out) {
      await logEvent("error.caught", memberId, `Summary was empty (${field})`, {
        source: "summarize-profile",
        cause: "empty_output",
        field,
        member_id: memberId,
        model: MODEL,
        input_chars: inputChars,
      });
      return null;
    }
    await logEvent("summary.generated", memberId, `${FIELD_LABEL[field]}: ${out}`, {
      source: "summarize-profile",
      field,
      member_id: memberId,
      model: MODEL,
      input_chars: inputChars,
      output_chars: out.length,
    });
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[summarize-profile] API call failed:", err);
    await logEvent("error.caught", memberId, `Summary API failed (${field}): ${msg.slice(0, 120)}`, {
      source: "summarize-profile",
      cause: "api_call_failed",
      field,
      member_id: memberId,
      model: MODEL,
      input_chars: inputChars,
      error_message: msg,
    });
    return null;
  }
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
 *
 * Each call (success or failure) emits one row to system_events. The summary
 * column on those rows is "Intro: ..." / "Ask: ..." / "Give: ..." so the
 * People/System feed reads naturally without repeating the member name (the
 * Subject column already shows it).
 */
export async function summarizeChangedFields(
  changed: ChangedFields,
  memberId: string,
): Promise<SummarizedFields> {
  const results: SummarizedFields = {};
  const tasks: Promise<void>[] = [];

  if (changed.intro !== undefined) {
    tasks.push(
      (async () => {
        if (!changed.intro) {
          results.current_intro_short = null;
        } else {
          const s = await summarize("intro", changed.intro, memberId);
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
          const s = await summarize("ask", changed.ask, memberId);
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
          const s = await summarize("give", changed.give, memberId);
          if (s !== null) results.current_give_short = s;
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return results;
}
