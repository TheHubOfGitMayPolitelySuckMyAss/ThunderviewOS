"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { createClient } from "@/lib/supabase/server";
import { formatName } from "@/lib/format";
import { sendApprovalEmail, sendReApplicationEmail, sendRejectionEmail } from "@/lib/email-send";
import { ensureAuthUser } from "@/lib/ensure-auth-user";
import {
  safeDeleteApplicationBox,
  safePushMember,
} from "@/lib/streak/safe-push";

type ApproveResult = {
  success: boolean;
  error?: string;
  memberId?: string;
  isExisting?: boolean;
  isKickedOut?: boolean;
  kickedOutName?: string;
};

export async function approveApplication(
  applicationId: string
): Promise<ApproveResult> {
  const admin = await createAdminClientForCurrentActor();

  const { data, error } = await admin.rpc("approve_application", {
    p_application_id: applicationId,
  });

  if (error) return { success: false, error: error.message };

  const result = data as {
    member_id: string;
    is_existing: boolean;
    is_kicked_out: boolean;
    member_name?: string;
  };

  if (result.is_kicked_out) {
    return {
      success: false,
      isKickedOut: true,
      memberId: result.member_id,
      kickedOutName: result.member_name,
    };
  }

  // Ensure auth.users row exists so the member can log in via magic link
  const { data: primaryEmail } = await admin
    .from("member_emails")
    .select("email")
    .eq("member_id", result.member_id)
    .eq("is_primary", true)
    .limit(1)
    .single();
  if (primaryEmail) {
    await ensureAuthUser(primaryEmail.email);
  }

  if (result.is_existing) {
    await sendReApplicationEmail(result.member_id);
  } else {
    await sendApprovalEmail(result.member_id);
  }

  // Streak housekeeping: route on box-key state, not is_existing. Cases:
  //   - app has box & member already has box   → orphan-delete the app box
  //   - app has box & member has no box        → migrate the box to member
  //   - app has no box                         → push will create one for member
  // Box-key writes use plain admin (infra plumbing, not an Eric-attributed edit).
  const housekeeping = createAdminClient();
  const { data: appBox } = await housekeeping
    .from("applications")
    .select("streak_box_key")
    .eq("id", applicationId)
    .single();
  const { data: memberBox } = await housekeeping
    .from("members")
    .select("streak_box_key")
    .eq("id", result.member_id)
    .single();

  if (appBox?.streak_box_key) {
    if (memberBox?.streak_box_key) {
      await safeDeleteApplicationBox(applicationId, "approve_application_orphan");
    } else {
      await housekeeping
        .from("members")
        .update({ streak_box_key: appBox.streak_box_key })
        .eq("id", result.member_id);
      await housekeeping
        .from("applications")
        .update({ streak_box_key: null })
        .eq("id", applicationId);
    }
  }

  await safePushMember(result.member_id, "approve_application");

  // No explicit application.approved log — audit row covers it via the
  // status pending→approved transition.

  return {
    success: true,
    memberId: result.member_id,
    isExisting: result.is_existing,
  };
}

export async function rejectApplication(
  applicationId: string,
  rejectionReason: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();

  const { error } = await admin
    .from("applications")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason,
    })
    .eq("id", applicationId);

  if (error) return { success: false, error: error.message };

  await safeDeleteApplicationBox(applicationId, "reject_application");

  await sendRejectionEmail(applicationId);

  // No explicit application.rejected log — audit row covers it via the
  // status pending→rejected transition.

  return { success: true };
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

  // Ensure auth.users row exists for the (possibly new) primary email
  const { data: primaryEmail } = await admin
    .from("member_emails")
    .select("email")
    .eq("member_id", result.member_id)
    .eq("is_primary", true)
    .limit(1)
    .single();
  if (primaryEmail) {
    await ensureAuthUser(primaryEmail.email);
  }

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
