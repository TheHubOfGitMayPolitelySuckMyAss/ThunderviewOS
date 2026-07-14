/**
 * Core approve/reject logic for applications, decoupled from the request
 * session so it can run from two entry points:
 *   - the admin UI server actions (actor resolved from the session)
 *   - the signed-link email flow (actor resolved from a verified token)
 *
 * Both pass an already-attributed admin client (see admin-with-actor.ts) so
 * the audit row gets the right actor_member_id either way. This file is NOT a
 * "use server" module — it must never be exposed as a POST-able server action.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendApprovalEmail,
  sendReApplicationEmail,
  sendRejectionEmail,
} from "@/lib/email-send";
import { ensureAuthUsersForMember } from "@/lib/ensure-auth-user";

export type ApproveResult = {
  success: boolean;
  error?: string;
  memberId?: string;
  isExisting?: boolean;
  isKickedOut?: boolean;
  kickedOutName?: string;
};

export async function approveApplicationWith(
  admin: SupabaseClient,
  applicationId: string
): Promise<ApproveResult> {
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

  // Ensure an auth.users row exists for every email on file so the member
  // can log in via any of them.
  await ensureAuthUsersForMember(result.member_id);

  if (result.is_existing) {
    await sendReApplicationEmail(result.member_id);
  } else {
    await sendApprovalEmail(result.member_id);
  }

  // No explicit application.approved log — audit row covers it via the
  // status pending→approved transition.

  return {
    success: true,
    memberId: result.member_id,
    isExisting: result.is_existing,
  };
}

export async function rejectApplicationWith(
  admin: SupabaseClient,
  applicationId: string,
  rejectionReason: string
): Promise<{ success: boolean; error?: string }> {
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

  // No explicit application.rejected log — audit row covers it via the
  // status pending→rejected transition.

  return { success: true };
}
