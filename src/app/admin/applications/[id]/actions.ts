"use server";

import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { createClient } from "@/lib/supabase/server";
import { formatName } from "@/lib/format";
import { sendReApplicationEmail } from "@/lib/email-send";
import { ensureAuthUsersForMember } from "@/lib/ensure-auth-user";
import {
  safeDeleteApplicationBox,
  safePushMember,
} from "@/lib/streak/safe-push";
import {
  approveApplicationWith,
  rejectApplicationWith,
  type ApproveResult,
} from "@/lib/application-review";

export async function approveApplication(
  applicationId: string
): Promise<ApproveResult> {
  const admin = await createAdminClientForCurrentActor();
  return approveApplicationWith(admin, applicationId);
}

export async function rejectApplication(
  applicationId: string,
  rejectionReason: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();
  return rejectApplicationWith(admin, applicationId, rejectionReason);
}

type LinkResult = {
  success: boolean;
  error?: string;
  memberId?: string;
  memberName?: string;
  isKickedOut?: boolean;
};

export async function linkApplicationToMember(
  applicationId: string,
  memberId: string
): Promise<LinkResult> {
  const admin = await createAdminClientForCurrentActor();

  const { data, error } = await admin.rpc("link_application_to_member", {
    p_application_id: applicationId,
    p_member_id: memberId,
  });

  if (error) return { success: false, error: error.message };

  const result = data as {
    member_id: string;
    member_name: string;
    is_kicked_out: boolean;
  };

  if (result.is_kicked_out) {
    return {
      success: false,
      isKickedOut: true,
      memberId: result.member_id,
      memberName: result.member_name,
    };
  }

  // Ensure an auth.users row exists for every email on file so the member
  // can log in via any of them.
  await ensureAuthUsersForMember(result.member_id);

  await sendReApplicationEmail(result.member_id);

  // Per spec: orphan-delete the application's Applied box (if any), then
  // push the existing member. Linked members already represent the same
  // human in Streak via the member's box, so the application box is redundant.
  await safeDeleteApplicationBox(applicationId, "link_application");
  await safePushMember(result.member_id, "link_application");

  // No explicit application.linked log — refineAuditRow now distinguishes
  // link (member existed before this UPDATE) from fresh approve (member was
  // created in the same RPC tx) using member.created_at vs the audit row's
  // changed_at. See APPROVE_VS_LINK_BUFFER_MS in src/lib/activity-feed.ts.

  return {
    success: true,
    memberId: result.member_id,
    memberName: result.member_name,
  };
}

/**
 * Hard-delete an application row. Used ONLY for spam — the normal flow is
 * Reject (which keeps the row as part of the suppression list and sends a
 * rejection email). Spam shouldn't suppress (don't want to let real future
 * applicants slip through if they coincidentally share an email) and
 * shouldn't email the spammer.
 *
 * Cleans up the Streak Applied-stage box if one exists, then DELETEs the
 * application. Audit row is written by the trigger automatically.
 */
export async function deleteSpamApplication(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();

  await safeDeleteApplicationBox(applicationId, "spam_delete");

  const { error } = await admin
    .from("applications")
    .delete()
    .eq("id", applicationId);

  if (error) return { success: false, error: error.message };

  return { success: true };
}

export async function searchMembers(
  query: string
): Promise<
  { id: string; name: string; company_name: string | null; primary_email: string }[]
> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("members")
    .select("id, first_name, last_name, company_name, member_emails(email, is_primary)")
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .order("first_name")
    .limit(10);

  return (data || []).map((m) => {
    const emails = m.member_emails as { email: string; is_primary: boolean }[];
    const primary =
      emails?.find((e) => e.is_primary)?.email ?? emails?.[0]?.email ?? "-";
    return {
      id: m.id,
      name: formatName(m.first_name, m.last_name),
      company_name: m.company_name,
      primary_email: primary,
    };
  });
}
