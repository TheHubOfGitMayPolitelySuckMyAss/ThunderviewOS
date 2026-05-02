/**
 * System events helper.
 *
 * Append-only event log for things not captured by audit.row_history (DB row
 * changes) or email_events (Resend webhook events). Examples: auth login,
 * cron run completions, transactional email dispatch, bulk email send,
 * webhook receipt, feedback submissions, caught errors.
 *
 * All inserts go through the service-role client because RLS on system_events
 * grants SELECT to admin/team only — there are no INSERT policies.
 *
 * Failures here MUST NOT break the calling code. We log loudly and continue.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type SystemEventInput = {
  event_type: string;
  actor_id?: string | null;
  actor_label?: string | null;
  subject_member_id?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logSystemEvent(input: SystemEventInput): Promise<void> {
  try {
    const admin = createAdminClient("system-internal");
    const { error } = await admin.from("system_events").insert({
      event_type: input.event_type,
      actor_id: input.actor_id ?? null,
      actor_label: input.actor_label ?? null,
      subject_member_id: input.subject_member_id ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata ?? {},
    });

    if (error) {
      console.error(
        `[system-events] Failed to log "${input.event_type}":`,
        error.message
      );
    }
  } catch (err) {
    console.error(
      `[system-events] Threw while logging "${input.event_type}":`,
      err
    );
  }
}
