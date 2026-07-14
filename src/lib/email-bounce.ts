/**
 * Hard-bounce cascade: when /api/webhooks/resend learns an address is
 * undeliverable (Permanent bounce, or second soft bounce escalation), flip
 * member_emails.email_status to 'bounced', auto-promote a non-bounced
 * secondary if the bounced address was the primary, and emit a small fixed
 * set of system_events rows that the System feed surfaces.
 *
 * (Historically also fed by a Streak "Bounced" webhook and followed by a
 * Streak stage push — the Streak integration was retired 2026-07.)
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/system-events";

type AdminClient = ReturnType<typeof createAdminClient>;

export type BounceActorLabel = "webhook:resend" | "gmail:label-action";

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
}): Promise<void> {
  const { admin, memberEmail, memberName, actorLabel } = opts;
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

}
