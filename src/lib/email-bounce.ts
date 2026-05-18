/**
 * Hard-bounce cascade shared by inbound webhook routes that learn an address
 * is undeliverable.
 *
 * Callers:
 *   - /api/webhooks/resend — Resend sent us a Permanent bounce event for a
 *     known recipient address.
 *   - /api/webhooks/streak/bounced — Eric manually moved a box to "Bounced"
 *     in Streak because the bounce came back to his inbox as unstructured
 *     text Resend can't parse (e.g., "Address not found").
 *
 * Both paths converge on the same downstream steps: flip member_emails.email_status
 * to 'bounced', auto-promote a non-bounced secondary if the bounced address was
 * the primary, push Streak so the box re-syncs, and emit a small fixed set of
 * system_events rows that the System feed surfaces.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/system-events";
import { safePushMember } from "@/lib/streak/safe-push";

type AdminClient = ReturnType<typeof createAdminClient>;

export type BounceActorLabel = "webhook:resend" | "webhook:streak";

export async function applyHardBounce(opts: {
  admin: AdminClient;
  memberEmail: {
    id: string;
    email: string;
    member_id: string;
    is_primary: boolean;
  };
  memberName: string | null;
  actorLabel: BounceActorLabel;
  safePushReason: string;
}): Promise<void> {
  const { admin, memberEmail, memberName, actorLabel, safePushReason } = opts;
  const recipientEmail = memberEmail.email;

  await admin
    .from("member_emails")
    .update({ email_status: "bounced" })
    .eq("id", memberEmail.id);

  await logSystemEvent({
    event_type: "email.status_set_bounced",
    actor_label: actorLabel,
    subject_member_id: memberEmail.member_id,
    summary: `Marked ${recipientEmail} as bounced on ${memberName ?? "member"}`,
    metadata: {
      recipient_email: recipientEmail,
      member_email_id: memberEmail.id,
      was_primary: memberEmail.is_primary,
    },
  });

  let promotedEmail: string | null = null;
  let streakOutcome: "primary_rotated" | "no_secondary_unreachable" | "secondary_retired" =
    memberEmail.is_primary ? "no_secondary_unreachable" : "secondary_retired";

  if (memberEmail.is_primary) {
    const { data: candidates } = await admin
      .from("member_emails")
      .select("id, email")
      .eq("member_id", memberEmail.member_id)
      .eq("email_status", "active")
      .neq("id", memberEmail.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const promotion = candidates?.[0];
    if (promotion) {
      const { error: rpcError } = await admin.rpc("swap_primary_email", {
        p_member_id: memberEmail.member_id,
        p_new_primary_email_id: promotion.id,
      });
      if (rpcError) {
        console.error("[email-bounce] swap_primary_email failed:", rpcError.message);
        await logSystemEvent({
          event_type: "error.caught",
          actor_label: actorLabel,
          summary: `swap_primary_email failed during bounce promotion: ${rpcError.message}`,
          metadata: {
            context: actorLabel,
            cause: "promote_secondary_failed",
            member_id: memberEmail.member_id,
            bounced_member_email_id: memberEmail.id,
            promoted_member_email_id: promotion.id,
            message: rpcError.message,
          },
        });
      } else {
        promotedEmail = promotion.email;
        streakOutcome = "primary_rotated";
        await logSystemEvent({
          event_type: "email.primary_promoted",
          actor_label: actorLabel,
          subject_member_id: memberEmail.member_id,
          summary: `Promoted ${promotion.email} to primary on ${memberName ?? "member"} (replacing bounced ${recipientEmail})`,
          metadata: {
            member_id: memberEmail.member_id,
            bounced_email: recipientEmail,
            promoted_member_email_id: promotion.id,
            promoted_email: promotion.email,
          },
        });
      }
    } else {
      await logSystemEvent({
        event_type: "email.no_secondary_available",
        actor_label: actorLabel,
        subject_member_id: memberEmail.member_id,
        summary: `${memberName ?? "Member"} has no deliverable email — ${recipientEmail} was their only active address`,
        metadata: {
          member_id: memberEmail.member_id,
          bounced_email: recipientEmail,
        },
      });
    }
  }

  await safePushMember(memberEmail.member_id, safePushReason);

  const outcomeSummary =
    streakOutcome === "primary_rotated"
      ? `Streak resynced: primary email rotated to ${promotedEmail}`
      : streakOutcome === "no_secondary_unreachable"
        ? `Streak resynced: member moved to Bounced stage (no deliverable email)`
        : `Streak resynced: secondary email retired (member still reachable)`;
  await logSystemEvent({
    event_type: "streak.bounce_synced",
    actor_label: actorLabel,
    subject_member_id: memberEmail.member_id,
    summary: outcomeSummary,
    metadata: {
      member_id: memberEmail.member_id,
      outcome: streakOutcome,
      bounced_email: recipientEmail,
      promoted_email: promotedEmail,
    },
  });
}
