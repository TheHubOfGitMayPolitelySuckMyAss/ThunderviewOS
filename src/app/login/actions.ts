"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { logSystemEvent } from "@/lib/system-events";

/**
 * Record that a magic link was successfully requested for `email`.
 *
 * signInWithOtp talks browser → Supabase directly, so nothing about the
 * request reaches our own logs. GoTrue records it, but those logs expire in
 * ~24h and aren't queryable on a schedule. This event is what the
 * login-stalled cron watches: request with no auth.login after it = someone
 * stuck in a loop, and the operator gets emailed.
 *
 * Only called by the login form AFTER signInWithOtp returns without error, so
 * a row here means a link really went out.
 *
 * Unknown emails are dropped silently — no row, same void return. Two reasons:
 * (a) shouldCreateUser is false, so a non-member never gets a link and can't
 * be "stalled"; (b) this action is publicly POST-able, and matching on a
 * member first keeps arbitrary strings out of system_events. The return value
 * is identical either way — this must not become an email-enumeration oracle.
 */
export async function logMagicLinkRequest(
  email: string,
  origin: string | null
): Promise<void> {
  try {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    const match = await findMemberByAnyEmail(
      createAdminClient("public-flow"),
      trimmed
    );
    if (!match) return;

    await logSystemEvent({
      event_type: "auth.magic_link_requested",
      actor_id: match.memberId,
      subject_member_id: match.memberId,
      summary: null,
      // `origin` is the host the form was served from. A magic link requested
      // from a host outside Supabase's redirect allow-list gets its
      // redirect_to silently swapped for Site URL and can never complete —
      // exactly the 2026-08-18 vercel.app failure. Capturing it here makes
      // that shape visible without digging through GoTrue logs.
      metadata: { email: trimmed, origin },
    });
  } catch (err) {
    // Never break login over telemetry.
    console.error("[login] Failed to log magic link request:", err);
  }
}
