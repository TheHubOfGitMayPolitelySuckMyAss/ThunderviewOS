"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createAdminClientForActor } from "@/lib/supabase/admin-with-actor";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { verifyApplicationActionToken } from "@/lib/application-action-token";
import {
  approveApplicationWith,
  rejectApplicationWith,
} from "@/lib/application-review";

const ADMIN_EMAIL = "eric@marcoullier.com";

export type ReviewOutcome =
  | "approved"
  | "rejected"
  | "already"
  | "invalid"
  | "kicked_out"
  | "missing_reason"
  | "error";

export type ReviewResult = {
  ok: boolean;
  outcome: ReviewOutcome;
  message: string;
};

/**
 * One-click email review handler. Trusts ONLY the signed token for the
 * application id + action (never a client-supplied action). Re-checks pending
 * status, then runs the same approve/reject core the admin UI uses — attributed
 * to the admin so the audit/People feed shows who acted.
 */
export async function submitApplicationReview(
  token: string,
  reason: string
): Promise<ReviewResult> {
  const verified = verifyApplicationActionToken(token);
  if (!verified) {
    return { ok: false, outcome: "invalid", message: "This link is invalid or has expired." };
  }

  const { applicationId, action } = verified;

  // Resolve the admin actor so the audit row is attributed (no session here).
  const lookupClient = createAdminClient("system-internal");
  const adminActor = await findMemberByAnyEmail(lookupClient, ADMIN_EMAIL);
  const admin = createAdminClientForActor(adminActor?.memberId ?? null);

  // Guard against double-submits / already-handled applications.
  const { data: current } = await lookupClient
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .maybeSingle();

  if (!current) {
    return { ok: false, outcome: "error", message: "Application not found." };
  }
  if (current.status !== "pending") {
    return {
      ok: false,
      outcome: "already",
      message: `Already marked ${current.status}. No action taken.`,
    };
  }

  if (action === "approve") {
    const result = await approveApplicationWith(admin, applicationId);
    if (result.isKickedOut) {
      return {
        ok: false,
        outcome: "kicked_out",
        message: `This is a removed member (${result.kickedOutName ?? "unknown"}). Handle it in the admin dashboard.`,
      };
    }
    if (!result.success) {
      return { ok: false, outcome: "error", message: result.error ?? "Approval failed." };
    }
    return { ok: true, outcome: "approved", message: "Approved. The applicant has been emailed." };
  }

  // reject
  const trimmed = reason.trim();
  if (!trimmed) {
    return {
      ok: false,
      outcome: "missing_reason",
      message: "A rejection reason is required.",
    };
  }

  const result = await rejectApplicationWith(admin, applicationId, trimmed);
  if (!result.success) {
    return { ok: false, outcome: "error", message: result.error ?? "Rejection failed." };
  }
  return { ok: true, outcome: "rejected", message: "Rejected. The applicant has been emailed." };
}
