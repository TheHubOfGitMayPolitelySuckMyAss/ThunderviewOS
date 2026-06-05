import { createAdminClient } from "@/lib/supabase/admin";
import { getDinnerAttendees, buildAttendeeHtml } from "@/lib/email-intros-asks";
import { isTestingMode } from "@/lib/email-mode";
import { logSystemEvent } from "@/lib/system-events";
import { sendMorningOfEmail } from "@/lib/email-send";

const ADMIN_EMAIL = "eric@marcoullier.com";

/**
 * Send the Morning Of email to every fulfilled attendee on a dinner.
 *
 * Shared by the manual admin button (with senderId) and the daily cron
 * (with senderId = null). Testing mode restricts recipients to admin + team;
 * the attendee list inside the email body is always the full list so the
 * preview matches what guests would see.
 *
 * Idempotency is enforced at the cron callsite (cron pre-checks
 * morning_of_sent_at). This helper unconditionally sends + writes the
 * stamp, which is the right behavior for the manual button (operator
 * already chose to send).
 *
 * NOT in a "use server" file on purpose: server actions are publicly
 * POST-able, and we don't want a "trigger Morning Of for any dinner ID"
 * endpoint exposed.
 */
export async function sendMorningOfToDinner(
  admin: ReturnType<typeof createAdminClient>,
  dinnerId: string,
  senderId: string | null
): Promise<{ sent: number; sentAt: string }> {
  const { data: dinner, error: dinnerErr } = await admin
    .from("dinners")
    .select("id, date, venue, address")
    .eq("id", dinnerId)
    .single();

  if (dinnerErr || !dinner) throw new Error(`Dinner not found: ${dinnerId}`);

  const attendees = await getDinnerAttendees(dinner.id, admin);
  const attendeeHtml = buildAttendeeHtml(attendees);
  const testing = isTestingMode();

  let sent = 0;
  for (const attendee of attendees) {
    if (!attendee.primary_email) continue;
    if (testing) {
      const isAdmin = attendee.primary_email === ADMIN_EMAIL;
      const isTeam = attendee.is_team === true;
      if (!isAdmin && !isTeam) continue;
    }
    await sendMorningOfEmail(
      attendee.primary_email,
      attendee.first_name,
      dinner.date,
      dinner.venue,
      dinner.address,
      attendeeHtml
    );
    sent++;
  }

  const sentAt = new Date().toISOString();

  await admin
    .from("dinners")
    .update({
      morning_of_sent_at: sentAt,
      morning_of_sent_by: senderId,
    })
    .eq("id", dinner.id);

  await logSystemEvent({
    event_type: "email.bulk_sent",
    actor_id: senderId,
    actor_label: senderId ? null : "cron:morning-of",
    summary: `Sent Morning Of email to ${sent} attendees`,
    metadata: {
      kind: "morning_of",
      dinner_id: dinner.id,
      dinner_date: dinner.date,
      recipient_count: sent,
    },
  });

  return { sent, sentAt };
}
