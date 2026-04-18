"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function approveApplication(
  applicationId: string
): Promise<{
  success: boolean;
  error?: string;
  memberId?: string;
  isExisting?: boolean;
}> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("approve_application", {
    p_application_id: applicationId,
  });

  if (error) return { success: false, error: error.message };

  const result = data as { member_id: string; is_existing: boolean };

  // TODO: Send approval email via Resend (Phase 3 email wiring)

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

  // TODO: Send rejection email via Resend (Phase 3 email wiring)

  return { success: true };
}
