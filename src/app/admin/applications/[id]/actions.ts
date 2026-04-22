"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatName } from "@/lib/format";
import { sendApprovalEmail, sendReApplicationEmail, sendRejectionEmail } from "@/lib/email-send";

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
  const admin = createAdminClient();

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

  if (result.is_existing) {
    await sendReApplicationEmail(result.member_id);
  } else {
    await sendApprovalEmail(result.member_id);
  }

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
  const admin = createAdminClient();

  const { error } = await admin
    .from("applications")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason,
    })
    .eq("id", applicationId);

  if (error) return { success: false, error: error.message };

  await sendRejectionEmail(applicationId);

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
  const admin = createAdminClient();

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

  await sendReApplicationEmail(result.member_id);

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
