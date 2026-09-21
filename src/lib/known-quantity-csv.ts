/**
 * Known Quantity attendee CSV — the monthly Thunderview → KQ push.
 *
 * Replaces the per-dinner JSON webhook to CoachingOS (deleted 2026-09-21 when
 * that endpoint started returning 404). KQ now accepts a whole CSV file at a
 * tokenised intake URL: the token IS the credential, no bearer, no headers.
 *
 * Shape of the file: a rolling 90-day window of dinner attendees, ONE ROW PER
 * PERSON (not per dinner) carrying their most recent details and the date of
 * their most recent dinner in the window.
 *
 * "Attendee" is a proxy. We don't track attendance and never have — the only
 * signal is `tickets.fulfillment_status = 'fulfilled'`, which means "we sent
 * them the dinner-details email." A no-show is indistinguishable from someone
 * who came. Eric confirmed this is the intended signal (2026-09-21); the KQ
 * side labels the card accordingly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const WINDOW_DAYS = 90;

/** Header order of the uploaded file. Compare against the API's echoed `columns`. */
export const CSV_COLUMNS = [
  "Thunderview Member ID",
  "Name",
  "Email",
  "Company",
  "Company Website",
  "LinkedIn",
  "Intro",
  "Ask",
  "Membership Status",
  "Last Dinner",
] as const;

export type AttendeeRow = {
  memberId: string;
  name: string;
  email: string;
  company: string;
  companyWebsite: string;
  linkedin: string;
  intro: string;
  ask: string;
  membershipStatus: "Active" | "Removed";
  lastDinner: string;
};

export type CollectResult = {
  rows: AttendeeRow[];
  windowStart: string;
  windowEnd: string;
  dinnerDates: string[];
  /** Kept as a metric, not a filter — a row with no address still records the meeting. */
  rowsWithoutEmail: number;
  /** Fulfilled-ticket holders dropped for having neither a name nor an email. */
  skippedUnidentifiable: number;
};

/** YYYY-MM-DD, `days` before `dateStr`. Date-only math, no timezone drift. */
export function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

type MemberEmailRow = {
  email: string;
  is_primary: boolean;
  email_status: string;
};

/**
 * Best address for a member: active primary, then any active, then primary,
 * then anything. The old CoachingOS sync inner-joined on primary AND active,
 * which silently dropped anyone whose primary address had hard-bounced.
 */
export function pickEmail(emails: MemberEmailRow[] | null | undefined): string {
  const list = emails ?? [];
  return (
    list.find((e) => e.is_primary && e.email_status === "active")?.email ??
    list.find((e) => e.email_status === "active")?.email ??
    list.find((e) => e.is_primary)?.email ??
    list[0]?.email ??
    ""
  );
}

type MemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  company_website: string | null;
  linkedin_profile: string | null;
  current_intro: string | null;
  current_ask: string | null;
  kicked_out: boolean;
  member_emails: MemberEmailRow[] | null;
};

/**
 * Every member holding a fulfilled ticket for a dinner in the window,
 * deduped to one row each, stamped with their latest dinner in the window.
 * Throws on any DB error — a failed read must never render as an empty file.
 */
export async function collectAttendees(
  admin: SupabaseClient,
  todayMT: string,
): Promise<CollectResult> {
  const windowEnd = todayMT;
  const windowStart = subtractDays(todayMT, WINDOW_DAYS);

  const { data: dinners, error: dinnerError } = await admin
    .from("dinners")
    .select("id, date")
    .gte("date", windowStart)
    .lte("date", windowEnd)
    .order("date", { ascending: true });
  if (dinnerError) {
    throw new Error(`dinners query failed: ${dinnerError.message}`);
  }

  const dinnerDateById = new Map<string, string>(
    (dinners ?? []).map((d) => [d.id as string, d.date as string]),
  );
  if (dinnerDateById.size === 0) {
    return {
      rows: [],
      windowStart,
      windowEnd,
      dinnerDates: [],
      rowsWithoutEmail: 0,
      skippedUnidentifiable: 0,
    };
  }

  const { data: tickets, error: ticketError } = await admin
    .from("tickets")
    .select("member_id, dinner_id")
    .in("dinner_id", Array.from(dinnerDateById.keys()))
    .eq("fulfillment_status", "fulfilled")
    .range(0, 999);
  if (ticketError) {
    throw new Error(`tickets query failed: ${ticketError.message}`);
  }
  if ((tickets?.length ?? 0) >= 1000) {
    throw new Error("tickets query hit the 1000-row PostgREST cap — paginate");
  }

  // Latest dinner per member inside the window.
  const latestDinnerByMember = new Map<string, string>();
  for (const t of tickets ?? []) {
    const memberId = t.member_id as string | null;
    if (!memberId) continue;
    const date = dinnerDateById.get(t.dinner_id as string);
    if (!date) continue;
    const seen = latestDinnerByMember.get(memberId);
    if (!seen || date > seen) latestDinnerByMember.set(memberId, date);
  }

  const memberIds = Array.from(latestDinnerByMember.keys());
  if (memberIds.length === 0) {
    return {
      rows: [],
      windowStart,
      windowEnd,
      dinnerDates: Array.from(dinnerDateById.values()),
      rowsWithoutEmail: 0,
      skippedUnidentifiable: 0,
    };
  }

  const { data: members, error: memberError } = await admin
    .from("members")
    .select(
      `id, first_name, last_name, company_name, company_website,
       linkedin_profile, current_intro, current_ask, kicked_out,
       member_emails(email, is_primary, email_status)`,
    )
    .in("id", memberIds)
    .range(0, 999);
  if (memberError) {
    throw new Error(`members query failed: ${memberError.message}`);
  }
  if ((members?.length ?? 0) >= 1000) {
    throw new Error("members query hit the 1000-row PostgREST cap — paginate");
  }

  let rowsWithoutEmail = 0;
  let skippedUnidentifiable = 0;
  const rows: AttendeeRow[] = [];

  for (const m of (members ?? []) as MemberRow[]) {
    const email = pickEmail(m.member_emails);
    const name = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
    if (!name && !email) {
      skippedUnidentifiable++;
      continue;
    }
    if (!email) rowsWithoutEmail++;
    rows.push({
      memberId: m.id,
      name,
      email,
      company: m.company_name ?? "",
      companyWebsite: m.company_website ?? "",
      linkedin: m.linkedin_profile ?? "",
      intro: m.current_intro ?? "",
      ask: m.current_ask ?? "",
      membershipStatus: m.kicked_out ? "Removed" : "Active",
      lastDinner: latestDinnerByMember.get(m.id) ?? "",
    });
  }

  // Most recent attendee first — the date the evidence happened is what sorts
  // the queue on the KQ side.
  rows.sort((a, b) =>
    a.lastDinner === b.lastDinner
      ? a.name.localeCompare(b.name)
      : b.lastDinner.localeCompare(a.lastDinner),
  );

  return {
    rows,
    windowStart,
    windowEnd,
    dinnerDates: Array.from(dinnerDateById.values()),
    rowsWithoutEmail,
    skippedUnidentifiable,
  };
}

/**
 * Flatten a value to a single CSV-safe line.
 *
 * Newlines are collapsed to spaces rather than quoted. RFC 4180 permits a
 * newline inside a quoted field, but the KQ intake parser counts it as a new
 * record — verified 2026-09-21: a correctly-quoted 2-record file with one
 * embedded newline came back `rows: 3`. Intros and asks are free text and
 * routinely contain line breaks, so every row count would be wrong.
 */
function flatten(value: string): string {
  return value.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

function escapeField(value: string): string {
  const flat = flatten(value);
  return /[",]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat;
}

export function toCsv(rows: AttendeeRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.memberId,
        r.name,
        r.email,
        r.company,
        r.companyWebsite,
        r.linkedin,
        r.intro,
        r.ask,
        r.membershipStatus,
        r.lastDinner,
      ]
        .map(escapeField)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export type UploadResult = {
  status: number;
  ok: boolean;
  body: {
    ok?: boolean;
    id?: string;
    rows?: number;
    columns?: string[];
    stored?: boolean;
    note?: string;
    error?: string;
  } | null;
  /** Their parsed row count disagreed with ours — the file is malformed. */
  rowCountMismatch: boolean;
  /** Their parsed header disagreed with ours. */
  columnMismatch: boolean;
};

/**
 * POST the CSV to the KQ intake URL. The whole credential is the token inside
 * `KNOWN_QUANTITY_CSV_URL` — nothing is sent in a header.
 *
 * A 200 means "stored whole," NOT "these people are in the CRM." Row
 * processing is a separate step on their side.
 */
export async function uploadCsv(
  csv: string,
  expectedRowCount: number,
): Promise<UploadResult> {
  const url = process.env.KNOWN_QUANTITY_CSV_URL;
  if (!url) {
    throw new Error("KNOWN_QUANTITY_CSV_URL is not set");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "text/csv" },
    body: csv,
  });
  const body = (await res.json().catch(() => null)) as UploadResult["body"];

  return {
    status: res.status,
    ok: res.ok && body?.ok === true && body?.stored === true,
    body,
    rowCountMismatch: res.ok && body?.rows !== expectedRowCount,
    columnMismatch:
      res.ok &&
      (body?.columns ?? []).join("|") !== CSV_COLUMNS.join("|"),
  };
}
