/**
 * Vercel Cron: login-stalled — every 2 minutes.
 *
 * Catches the failure shape that leaves no error anywhere: a member requests a
 * magic link and simply never arrives. When the link itself is broken (bad
 * redirect_to, dead host, mail never delivered) nothing hits /auth/confirm, so
 * there is no auth.login_failed to alarm on — the only visible fact is a
 * request with no success after it.
 *
 * Fires an email to the operator so he can reach out while the person is still
 * sitting there trying.
 *
 *   requested >= STALL_MINUTES ago, no auth.login since → alert
 *
 * Deliberately noisy-side: someone who wandered off and logs in an hour later
 * still generates one alert. Eric's call — a live person stuck at the door is
 * worth more than a quiet inbox, and the email says to re-check the portal.
 *
 * Heartbeat deviation (same as mail-merge-drain / gmail-label-actions): 720
 * fires a day would flood system_events, so it emits cron.login_stalled only
 * when it actually alerted.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLoginStalledNotification } from "@/lib/email-send";
import { logSystemEvent } from "@/lib/system-events";

/** How long after a request we call it stalled. */
const STALL_MINUTES = 10;
/**
 * How far back to look. Anything older was already evaluated by an earlier
 * run (cron fires every 2 min); the wide margin just absorbs downtime.
 */
const LOOKBACK_MINUTES = 60;
/** One alert per member per day, however many times they retry. */
const DEDUPE_HOURS = 24;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runLoginStalled();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logSystemEvent({
      event_type: "error.caught",
      actor_label: "cron:login-stalled",
      summary: `login-stalled cron threw: ${error.message}`,
      metadata: {
        context: "cron.login_stalled",
        message: error.message,
        stack: error.stack ?? null,
      },
    });
    return NextResponse.json({ ran: true, error: error.message }, { status: 500 });
  }
}

type Pending = {
  memberId: string;
  firstRequestedAt: string;
  attempts: number;
  origins: Set<string>;
  email: string | null;
};

async function runLoginStalled() {
  const admin = createAdminClient("cron");
  const now = Date.now();
  const windowEnd = new Date(now - STALL_MINUTES * 60 * 1000).toISOString();
  const windowStart = new Date(now - LOOKBACK_MINUTES * 60 * 1000).toISOString();

  const { data: requests, error: requestsError } = await admin
    .from("system_events")
    .select("subject_member_id, occurred_at, metadata")
    .eq("event_type", "auth.magic_link_requested")
    .gte("occurred_at", windowStart)
    .lte("occurred_at", windowEnd)
    .order("occurred_at", { ascending: true })
    .range(0, 999);

  // A failed read must not read as "nobody is stuck."
  if (requestsError) throw new Error(`request lookup failed: ${requestsError.message}`);
  if (!requests || requests.length === 0) {
    return NextResponse.json({ ran: true, checked: 0, alerted: 0 });
  }

  // Collapse retries: one person hammering the button is one alert.
  const pending = new Map<string, Pending>();
  for (const row of requests) {
    const memberId = row.subject_member_id as string | null;
    if (!memberId) continue;
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const existing = pending.get(memberId);
    if (existing) {
      existing.attempts++;
      if (typeof metadata.origin === "string") existing.origins.add(metadata.origin);
    } else {
      pending.set(memberId, {
        memberId,
        firstRequestedAt: row.occurred_at as string,
        attempts: 1,
        origins: new Set(typeof metadata.origin === "string" ? [metadata.origin] : []),
        email: typeof metadata.email === "string" ? metadata.email : null,
      });
    }
  }

  const memberIds = Array.from(pending.keys());

  // Who got in, and who was already reported today.
  const dedupeSince = new Date(now - DEDUPE_HOURS * 60 * 60 * 1000).toISOString();
  const [{ data: logins, error: loginsError }, { data: alerted, error: alertedError }] =
    await Promise.all([
      admin
        .from("system_events")
        .select("subject_member_id, occurred_at")
        .eq("event_type", "auth.login")
        .in("subject_member_id", memberIds)
        .gte("occurred_at", windowStart)
        .range(0, 999),
      admin
        .from("system_events")
        .select("subject_member_id")
        .eq("event_type", "auth.login_stalled")
        .in("subject_member_id", memberIds)
        .gte("occurred_at", dedupeSince)
        .range(0, 999),
    ]);

  if (loginsError) throw new Error(`login lookup failed: ${loginsError.message}`);
  if (alertedError) throw new Error(`dedupe lookup failed: ${alertedError.message}`);

  // Latest successful login per member, so "did they get in after asking?" is
  // a single comparison below.
  const lastLoginByMember = new Map<string, string>();
  for (const row of logins ?? []) {
    const id = row.subject_member_id as string;
    const at = row.occurred_at as string;
    const prev = lastLoginByMember.get(id);
    if (!prev || at > prev) lastLoginByMember.set(id, at);
  }
  const alreadyAlerted = new Set((alerted ?? []).map((r) => r.subject_member_id as string));

  const stalled = Array.from(pending.values()).filter((p) => {
    if (alreadyAlerted.has(p.memberId)) return false;
    const lastLogin = lastLoginByMember.get(p.memberId);
    return !lastLogin || lastLogin < p.firstRequestedAt;
  });

  if (stalled.length === 0) {
    return NextResponse.json({ ran: true, checked: memberIds.length, alerted: 0 });
  }

  const { data: members } = await admin
    .from("members")
    .select("id, first_name, last_name")
    .in(
      "id",
      stalled.map((s) => s.memberId)
    );
  const nameById = new Map(
    (members ?? []).map((m) => [
      m.id as string,
      `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "(unnamed member)",
    ])
  );

  for (const p of stalled) {
    const minutesSince = Math.round((now - new Date(p.firstRequestedAt).getTime()) / 60000);
    const memberName = nameById.get(p.memberId) ?? "(deleted member)";

    await sendLoginStalledNotification({
      memberId: p.memberId,
      memberName,
      email: p.email ?? "(unknown)",
      requestedAt: p.firstRequestedAt,
      attempts: p.attempts,
      origins: Array.from(p.origins),
      minutesSince,
    });

    // Written after the send so a crash mid-send retries next tick rather than
    // silently swallowing the only alert this member gets today.
    await logSystemEvent({
      event_type: "auth.login_stalled",
      actor_label: "cron:login-stalled",
      subject_member_id: p.memberId,
      summary: `${memberName} requested a magic link ${minutesSince}m ago and never logged in`,
      metadata: {
        email: p.email,
        attempts: p.attempts,
        origins: Array.from(p.origins),
        first_requested_at: p.firstRequestedAt,
        minutes_since: minutesSince,
      },
    });
  }

  await logSystemEvent({
    event_type: "cron.login_stalled",
    actor_label: "cron:login-stalled",
    summary: `login-stalled alerted on ${stalled.length} member${stalled.length === 1 ? "" : "s"}`,
    metadata: {
      outcome: "success",
      checked: memberIds.length,
      alerted: stalled.length,
    },
  });

  return NextResponse.json({ ran: true, checked: memberIds.length, alerted: stalled.length });
}
