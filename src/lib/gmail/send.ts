/**
 * Send mail as Eric, through his own Gmail account, via the Gmail API.
 *
 * Ported from DigiEric (apps/web/lib/gmail-send.ts), trimmed to what mail
 * merges need: no attachments, no reply threading. Divergence: the body input
 * is HTML (RichTextEditor output), not plain text — the text/plain alternative
 * is derived via htmlToText.
 *
 * Why Gmail API and not Resend: a mail merge must look like a one-to-one
 * email — sent from eric@marcoullier.com, landing in his Sent folder, replies
 * threading in his inbox, carrying his real Gmail signature. Resend can do
 * none of that.
 */

export interface SendAsIdentity {
  email: string;
  displayName: string | null;
  /** Gmail signature HTML for this identity, or "" if none configured. */
  signature: string;
}

/**
 * Fetch the primary send-as identity (address, display name, signature) from
 * Gmail settings. Needs gmail.settings.basic. Returns null on any failure —
 * mail-merge callers treat a missing signature as a hard error (Eric's sig is
 * a requirement, not a nice-to-have), but that policy lives at the call site.
 */
export async function getPrimarySendAs(
  accessToken: string
): Promise<SendAsIdentity | null> {
  try {
    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      sendAs?: {
        sendAsEmail: string;
        displayName?: string;
        signature?: string;
        isPrimary?: boolean;
        isDefault?: boolean;
      }[];
    };
    const list = data.sendAs ?? [];
    const primary =
      list.find((s) => s.isPrimary) ?? list.find((s) => s.isDefault) ?? list[0];
    if (!primary) return null;
    return {
      email: primary.sendAsEmail,
      displayName: primary.displayName || null,
      signature: primary.signature ?? "",
    };
  } catch {
    return null;
  }
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);
}

/** Crude HTML → text for the plaintext alternative. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|tr|h[1-6]|li)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** UTF-8 → URL-safe base64 (no padding), per Gmail's `raw` field. */
function base64UrlUtf8(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** RFC 2047 encode a header value if it contains non-ASCII, else pass through. */
export function encodeSubject(subject: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

export interface BuildMessageInput {
  to: string;
  fromEmail: string;
  fromName?: string | null;
  subject: string;
  /** HTML body (greeting + typed content), signature NOT included. */
  bodyHtml: string;
  /** Gmail signature HTML to append, or "" for none. */
  signatureHtml?: string;
  /** Override the MIME boundary (tests pass a fixed value). */
  boundary?: string;
}

/**
 * Build a base64url-encoded RFC 822 message ready for users.messages.send:
 * multipart/alternative with text/plain (derived) and text/html parts, the
 * signature appended to both.
 */
export function buildRawMessage(input: BuildMessageInput): string {
  const {
    to,
    fromEmail,
    fromName,
    subject,
    bodyHtml,
    signatureHtml = "",
    boundary = `thunderview_${Math.random().toString(36).slice(2)}`,
  } = input;

  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const bodyText = htmlToText(bodyHtml);
  const sigText = signatureHtml ? htmlToText(signatureHtml) : "";
  const textPart = sigText ? `${bodyText}\n\n${sigText}` : bodyText;
  // No <br>s at the junction: the body ends with a block element (<p>/<div>)
  // whose bottom margin renders as the single blank line before the signature,
  // matching a hand-typed Gmail reply. Explicit breaks here stacked on top of
  // that margin and produced a 3-4 line gap.
  const htmlPart = signatureHtml ? `${bodyHtml}${signatureHtml}` : bodyHtml;

  const lines = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    textPart,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    htmlPart,
    "",
    `--${boundary}--`,
    "",
  ];

  // Normalize every line ending — including those inside the body/signature —
  // to CRLF, as RFC 822 requires.
  return base64UrlUtf8(lines.join("\n").replace(/\r?\n/g, "\r\n"));
}

export interface SendResult {
  id: string;
  threadId: string;
}

/** Error subtype for auth/quota failures that should abort a whole drain run. */
export class GmailFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailFatalError";
  }
}

/**
 * POST a prebuilt raw message to Gmail. Throws GmailFatalError on 401/403/429
 * (revoked grant, missing scope, quota exhausted — retrying the next recipient
 * would fail identically), plain Error on anything else (recipient-specific).
 */
export async function sendMessage(
  accessToken: string,
  raw: string
): Promise<SendResult> {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const message = `Gmail send failed (${res.status}): ${detail}`;
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      throw new GmailFatalError(message);
    }
    throw new Error(message);
  }
  const data = (await res.json()) as { id: string; threadId: string };
  return { id: data.id, threadId: data.threadId };
}
