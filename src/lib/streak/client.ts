/**
 * Streak API v1 client.
 *
 * Auth: HTTP Basic with API key as username, empty password.
 * Rate: in-process queue paces requests at ≤ 8/sec (margin under Streak's
 *       documented 10/sec ceiling).
 * Retry: exponential backoff on 429 (max 3 retries); single retry on 5xx;
 *        all other non-2xx surface as thrown errors with status + body.
 *
 * Every call emits a `streak.api_call` system_events row for observability.
 * Logging never throws — failures inside logSystemEvent are swallowed there.
 */

import { logSystemEvent } from "@/lib/system-events";

const BASE_V1 = "https://www.streak.com/api/v1";
const BASE_V2 = "https://api.streak.com/api/v2";

// Pacing: at most 8 requests per second.
// Token bucket: refill 8 tokens per 1000ms.
const TOKENS_PER_SECOND = 8;
const REFILL_INTERVAL_MS = 1000;

let availableTokens = TOKENS_PER_SECOND;
let lastRefillAt = Date.now();
const waiters: Array<() => void> = [];

function refill() {
  const now = Date.now();
  const elapsed = now - lastRefillAt;
  if (elapsed >= REFILL_INTERVAL_MS) {
    availableTokens = TOKENS_PER_SECOND;
    lastRefillAt = now;
  }
}

async function acquireToken(): Promise<void> {
  refill();
  if (availableTokens > 0) {
    availableTokens--;
    return;
  }
  // Wait until the next refill window, then retry.
  const waitMs = Math.max(
    1,
    REFILL_INTERVAL_MS - (Date.now() - lastRefillAt)
  );
  await new Promise<void>((resolve) => {
    waiters.push(resolve);
    setTimeout(() => {
      const idx = waiters.indexOf(resolve);
      if (idx !== -1) waiters.splice(idx, 1);
      resolve();
    }, waitMs);
  });
  return acquireToken();
}

function authHeader(): string {
  const key = process.env.STREAK_API_KEY;
  if (!key) {
    throw new Error("STREAK_API_KEY is not set");
  }
  const encoded = Buffer.from(`${key}:`).toString("base64");
  return `Basic ${encoded}`;
}

// Streak's body content-type rule (empirical, not documented anywhere coherent):
//   v1 PUT  endpoints (createBox, createPipelineField) want form-urlencoded.
//   v1 POST endpoints (updateBox, setBoxField)         want JSON.
//   v2 endpoints (Contacts API)                        always want JSON.
// Sending JSON to a v1 PUT endpoint returns "Insufficient params for Field";
// sending form-urlencoded to a v1 POST endpoint silently returns nulls.
// The client picks the right encoding from the (version, method) tuple, so
// callers don't need to think about it.
type StreakBody = Record<string, unknown>;
type StreakVersion = 1 | 2;

type RequestInit = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: StreakBody;
  /** API version. Default 1. v2 hosts the Contacts API. */
  version?: StreakVersion;
  /** Optional query params, merged into the URL. */
  query?: Record<string, string | undefined>;
};

function encodeForm(body: StreakBody): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    params.append(k, String(v));
  }
  return params.toString();
}

class StreakError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, path: string) {
    super(`Streak API ${status} on ${path}: ${body.slice(0, 500)}`);
    this.status = status;
    this.body = body;
  }
}

async function streakFetch(
  path: string,
  init: RequestInit = {}
): Promise<unknown> {
  const method = init.method ?? "GET";
  const version = init.version ?? 1;
  const base = version === 2 ? BASE_V2 : BASE_V1;
  let url = `${base}${path}`;
  if (init.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) qs.append(k, v);
    }
    const qstr = qs.toString();
    if (qstr) url += (url.includes("?") ? "&" : "?") + qstr;
  }

  // Backoff schedule for 429: 500ms, 1500ms, 3500ms (exponential-ish).
  // 5xx: single retry after 500ms.
  let attempt = 0;
  const maxAttempts = 4; // 1 original + up to 3 retries

  // Outer retry loop. The first failed 5xx counts as a retryable attempt too.
  // We track 5xx separately so we don't burn three slots on transient 500s.
  let fivexxRetried = false;

  // Capture timing across all attempts for the system event.
  const startedAt = Date.now();
  let lastStatus = 0;
  let lastBody = "";

  while (attempt < maxAttempts) {
    await acquireToken();

    const headers: Record<string, string> = {
      Authorization: authHeader(),
      Accept: "application/json",
    };
    let body: BodyInit | undefined;
    if (init.body !== undefined) {
      if (version === 1 && method === "PUT") {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        body = encodeForm(init.body);
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(init.body);
      }
    }

    let res: Response;
    try {
      res = await fetch(url, { method, headers, body });
    } catch (err) {
      // Network errors: count as 5xx-style retryable once.
      if (!fivexxRetried) {
        fivexxRetried = true;
        attempt++;
        await sleep(500);
        continue;
      }
      throw err;
    }

    lastStatus = res.status;
    lastBody = await res.text();

    if (res.ok) {
      void logSystemEvent({
        event_type: "streak.api_call",
        metadata: {
          method,
          path,
          version,
          status: res.status,
          duration_ms: Date.now() - startedAt,
        },
      });
      return lastBody.length > 0 ? JSON.parse(lastBody) : null;
    }

    if (res.status === 429) {
      attempt++;
      if (attempt >= maxAttempts) break;
      const backoff = 500 * Math.pow(2, attempt - 1);
      await sleep(backoff);
      continue;
    }

    if (res.status >= 500 && res.status < 600) {
      if (!fivexxRetried) {
        fivexxRetried = true;
        attempt++;
        await sleep(500);
        continue;
      }
      break;
    }

    // 4xx (other than 429): no retry.
    break;
  }

  void logSystemEvent({
    event_type: "streak.api_call",
    metadata: {
      method,
      path,
      version,
      status: lastStatus,
      duration_ms: Date.now() - startedAt,
      failed: true,
    },
  });
  throw new StreakError(lastStatus, lastBody, `${method} ${path}`);
}

export { StreakError };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Streak shapes — only the fields we actually read are typed. Unknown keys
// are tolerated.

export type StreakPipeline = {
  pipelineKey: string;
  name: string;
};

export type StreakStageRow = {
  key: string;
  name: string;
};

// Streak returns stages as an object keyed by stageKey. Each value carries a
// `name` and `key`.
export type StreakStagesResponse = Record<string, StreakStageRow>;

export type StreakField = {
  key: string;
  name: string;
  type: string;
};

export type StreakBox = {
  boxKey: string;
  name: string;
  pipelineKey: string;
  stageKey: string;
};

export async function listPipelines(): Promise<StreakPipeline[]> {
  const data = (await streakFetch("/pipelines")) as StreakPipeline[];
  return data ?? [];
}

export async function getPipeline(pipelineKey: string): Promise<StreakPipeline> {
  return (await streakFetch(`/pipelines/${pipelineKey}`)) as StreakPipeline;
}

export async function listPipelineFields(
  pipelineKey: string
): Promise<StreakField[]> {
  const data = (await streakFetch(
    `/pipelines/${pipelineKey}/fields`
  )) as StreakField[];
  return data ?? [];
}

export async function createPipelineField(
  pipelineKey: string,
  args: { name: string; type?: string }
): Promise<StreakField> {
  return (await streakFetch(`/pipelines/${pipelineKey}/fields`, {
    method: "PUT",
    body: { name: args.name, type: args.type ?? "TEXT_INPUT" },
  })) as StreakField;
}

export async function listPipelineStages(
  pipelineKey: string
): Promise<StreakStagesResponse> {
  return (await streakFetch(
    `/pipelines/${pipelineKey}/stages`
  )) as StreakStagesResponse;
}

export async function createBox(
  pipelineKey: string,
  args: { name: string; stageKey?: string }
): Promise<StreakBox> {
  return (await streakFetch(`/pipelines/${pipelineKey}/boxes`, {
    method: "PUT",
    body: { name: args.name, stageKey: args.stageKey },
  })) as StreakBox;
}

export async function getBox(boxKey: string): Promise<StreakBox> {
  return (await streakFetch(`/boxes/${boxKey}`)) as StreakBox;
}

export async function updateBox(
  boxKey: string,
  args: { name?: string; stageKey?: string }
): Promise<StreakBox> {
  return (await streakFetch(`/boxes/${boxKey}`, {
    method: "POST",
    body: args,
  })) as StreakBox;
}

export async function setBoxField(
  boxKey: string,
  fieldKey: string,
  value: unknown
): Promise<unknown> {
  return await streakFetch(`/boxes/${boxKey}/fields/${fieldKey}`, {
    method: "POST",
    body: { value },
  });
}

export async function deleteBox(boxKey: string): Promise<void> {
  await streakFetch(`/boxes/${boxKey}`, { method: "DELETE" });
}

// === Contacts (v2) + box-contact linking ===
//
// Streak's mail-merge UI pulls recipients from Contacts, NOT from custom
// columns. So even though our boxes have an "Email" custom field populated,
// merges return zero recipients until each box has an attached contact.
//
// Contacts are team-scoped, not pipeline-scoped. We resolve the team key
// once (see ensureStreakReady) and reuse it for every contact call.

export type StreakContact = {
  key: string;
  emailAddresses?: string[];
  givenName?: string;
  familyName?: string;
};

export async function createContact(
  teamKey: string,
  args: { emailAddress: string; getIfExisting?: boolean }
): Promise<StreakContact> {
  // When getIfExisting=true, the body MUST contain only emailAddresses.
  // Streak rejects name fields in that mode. Update name separately via
  // updateContact() afterward if needed.
  return (await streakFetch(`/teams/${teamKey}/contacts/`, {
    method: "POST",
    version: 2,
    body: { emailAddresses: [args.emailAddress] },
    query: args.getIfExisting ? { getIfExisting: "true" } : undefined,
  })) as StreakContact;
}

export async function updateContact(
  contactKey: string,
  args: { givenName?: string; familyName?: string }
): Promise<StreakContact> {
  // NOTE: update endpoint is NOT team-scoped, despite create being so. The
  // path is `/v2/contacts/{contactKey}` — the contact's team is inferred
  // from the contact itself. POST to `/v2/teams/{teamKey}/contacts/{key}`
  // returns 400 "Invalid API path specified".
  return (await streakFetch(`/contacts/${contactKey}`, {
    method: "POST",
    version: 2,
    body: args,
  })) as StreakContact;
}

/**
 * Link a contact to a box. The field is `contacts` (array of objects with
 * `key`). Per Streak's docs: "The only contacts associated with the box will
 * be the ones you include here" — so this is REPLACE semantics, not append.
 *
 * For our use case (one canonical contact per box, the member's primary
 * email or best non-bounced alternative), replace is fine. If we ever need
 * to preserve manually-added contacts on a box, fetch first and merge.
 *
 * Other shapes that don't work (probed during Prompt D):
 *   - { linkedContactKeys: [key] }  — accepted (200) but doesn't persist
 *   - { contactKeys: [key] }        — same, ignored
 *   - { contacts: [key] }           — silent null response
 *   - { contacts: [{contactKey}] }  — silent null response
 *   - { contacts: [{emailAddress}] } — silent null response
 */
export async function addContactToBox(
  boxKey: string,
  contactKey: string
): Promise<void> {
  await streakFetch(`/boxes/${boxKey}`, {
    method: "POST",
    body: { contacts: [{ key: contactKey }] },
  });
}
