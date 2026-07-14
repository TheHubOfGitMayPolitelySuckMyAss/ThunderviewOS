/**
 * Identify the member email address a labeled Gmail message is about.
 *
 * "bounce" → the recipient address that failed to deliver (mailer-daemon
 * notifications, or a forwarded bounce). "skip" → the member saying they
 * can't make the upcoming dinner. "optout" → the member asking to stop
 * receiving emails. For skip/optout it's usually the From address, but the
 * body wins when Eric forwards on someone's behalf.
 *
 * Same lazy-client / catch-and-report pattern as summarize-profile. Returns
 * { email: null } with a reason instead of throwing — the caller turns that
 * into a TV Error label + reply to Eric.
 */

import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

const MODEL = "claude-opus-4-8";
const MAX_BODY_CHARS = 6000;

const BOUNCE_PROMPT = `The email below was flagged in Eric's inbox as a bounce notification (a delivery-failure report, or a forward of one). Identify the single recipient email address that failed to deliver.

Do NOT return mailer-daemon/postmaster addresses, Eric's own address (eric@marcoullier.com), or the sending domain's addresses — only the address the original message could not be delivered TO.

Output ONLY that email address, lowercase. If you cannot confidently identify it, output exactly NONE.`;

const SKIP_PROMPT = `The email below was flagged in Eric's inbox as a member saying they can't attend the upcoming Thunderview dinner ("not this time"). Identify that member's email address.

It is usually the From address. If the message is a forward or mentions that a DIFFERENT person can't attend, prefer the address of the person who can't attend. Never return eric@marcoullier.com.

Output ONLY that email address, lowercase. If you cannot confidently identify it, output exactly NONE.`;

const OPTOUT_PROMPT = `The email below was flagged in Eric's inbox as a person asking to stop receiving Thunderview emails (unsubscribe / "take me off the list"). Identify that person's email address.

It is usually the From address. If the message is a forward or mentions that a DIFFERENT person wants off the list, prefer that person's address. Never return eric@marcoullier.com.

Output ONLY that email address, lowercase. If you cannot confidently identify it, output exactly NONE.`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ExtractTargetResult =
  | { email: string }
  | { email: null; reason: string };

const PROMPT_BY_KIND = {
  bounce: BOUNCE_PROMPT,
  skip: SKIP_PROMPT,
  optout: OPTOUT_PROMPT,
} as const;

export async function extractTargetEmail(
  kind: "bounce" | "skip" | "optout",
  message: { from: string | null; subject: string | null; body: string }
): Promise<ExtractTargetResult> {
  const prompt = PROMPT_BY_KIND[kind];
  const content = [
    prompt,
    "",
    `From: ${message.from ?? "(unknown)"}`,
    `Subject: ${message.subject ?? "(none)"}`,
    "",
    message.body.slice(0, MAX_BODY_CHARS) || "(empty body)",
  ].join("\n");

  let raw: string;
  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content }],
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return { email: null, reason: "extraction returned no text" };
    }
    raw = block.text.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { email: null, reason: `extraction API call failed: ${msg}` };
  }

  const candidate = raw.toLowerCase().replace(/^<|>$/g, "");
  if (candidate === "none" || !EMAIL_RE.test(candidate)) {
    return {
      email: null,
      reason: `couldn't identify a target email address (model said: ${raw.slice(0, 120)})`,
    };
  }
  return { email: candidate };
}
