/**
 * Gmail label + message-read helpers for the label-actions cron.
 *
 * Needs the gmail.modify scope (see /api/auth/google). All calls follow the
 * send.ts error convention: GmailFatalError on 401/403/429 (dead grant,
 * missing scope, quota — the whole run should abort), plain Error otherwise.
 */

import { GmailFatalError, htmlToText } from "./send";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const message = `Gmail API ${path} failed (${res.status}): ${detail}`;
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      throw new GmailFatalError(message);
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/**
 * Resolve label names to IDs, creating any that don't exist yet. Returns a
 * map keyed by the exact names passed in.
 */
export async function ensureLabels(
  accessToken: string,
  names: string[]
): Promise<Map<string, string>> {
  const { labels } = await gmailFetch<{
    labels?: { id: string; name: string }[];
  }>(accessToken, "/labels");
  const byName = new Map((labels ?? []).map((l) => [l.name, l.id]));

  const result = new Map<string, string>();
  for (const name of names) {
    const existing = byName.get(name);
    if (existing) {
      result.set(name, existing);
      continue;
    }
    const created = await gmailFetch<{ id: string }>(accessToken, "/labels", {
      method: "POST",
      body: JSON.stringify({
        name,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      }),
    });
    result.set(name, created.id);
  }
  return result;
}

/** Message IDs currently carrying the given label (capped at 25 per run). */
export async function listMessageIdsWithLabel(
  accessToken: string,
  labelId: string
): Promise<string[]> {
  const data = await gmailFetch<{ messages?: { id: string }[] }>(
    accessToken,
    `/messages?labelIds=${encodeURIComponent(labelId)}&maxResults=25`
  );
  return (data.messages ?? []).map((m) => m.id);
}

export interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  payload?: GmailMessagePart & {
    headers?: { name: string; value: string }[];
  };
}

export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?format=full`
  );
}

export async function modifyMessageLabels(
  accessToken: string,
  messageId: string,
  addLabelIds: string[],
  removeLabelIds: string[]
): Promise<void> {
  await gmailFetch(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/modify`,
    {
      method: "POST",
      body: JSON.stringify({ addLabelIds, removeLabelIds }),
    }
  );
}

export function getHeader(
  message: GmailMessage,
  name: string
): string | null {
  const headers = message.payload?.headers ?? [];
  const match = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return match?.value ?? null;
}

function decodeBody(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8"
  );
}

/**
 * Best-effort plain-text extraction: walk the MIME tree preferring text/plain,
 * falling back to stripped text/html. Bounce notifications nest the failed
 * message as message/rfc822 parts — the walk descends into those too, which
 * is what surfaces the failed recipient address.
 */
export function extractPlainText(message: GmailMessage): string {
  const plainChunks: string[] = [];
  const htmlChunks: string[] = [];

  function walk(part: GmailMessagePart | undefined): void {
    if (!part) return;
    if (part.body?.data) {
      if (part.mimeType === "text/plain") {
        plainChunks.push(decodeBody(part.body.data));
      } else if (part.mimeType === "text/html") {
        htmlChunks.push(decodeBody(part.body.data));
      }
    }
    for (const child of part.parts ?? []) walk(child);
  }

  walk(message.payload);
  if (plainChunks.length > 0) return plainChunks.join("\n\n");
  if (htmlChunks.length > 0) return htmlToText(htmlChunks.join("\n\n"));
  return "";
}
