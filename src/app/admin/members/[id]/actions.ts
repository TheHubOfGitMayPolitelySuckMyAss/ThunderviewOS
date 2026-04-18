"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function updateMemberField(
  memberId: string,
  field: string,
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const updates: Record<string, unknown> = { [field]: value };

  // If updating current_ask, also set ask_updated_at
  if (field === "current_ask") {
    updates.ask_updated_at = new Date().toISOString();
  }
  // intro_updated_at is handled by the DB trigger

  const { error } = await admin
    .from("members")
    .update(updates)
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleMemberFlag(
  memberId: string,
  field: "marketing_opted_in" | "is_team",
  value: boolean
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ [field]: value })
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function removeMember(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ kicked_out: true, marketing_opted_in: false })
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function reinstateMember(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ kicked_out: false, marketing_opted_in: true })
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Email management actions

export async function addMemberEmail(
  memberId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("member_emails").insert({
    member_id: memberId,
    email: email.toLowerCase(),
    is_primary: false,
    source: "manual",
    email_status: "active",
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteMemberEmail(
  emailId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("member_emails")
    .delete()
    .eq("id", emailId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function setPrimaryEmail(
  memberId: string,
  emailId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const { error } = await admin.rpc("swap_primary_email", {
    p_member_id: memberId,
    p_new_primary_email_id: emailId,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type EmailCheckResult = {
  existingMember?: { id: string; name: string };
  pendingApp?: { id: string };
  rejectedApp?: { id: string };
};

export async function checkEmailForMember(
  email: string,
  excludeMemberId: string
): Promise<EmailCheckResult> {
  const supabase = await createClient();

  const { data: memberEmail } = await supabase
    .from("member_emails")
    .select("member_id, members(id, name)")
    .eq("email", email.toLowerCase())
    .limit(1)
    .single();

  if (memberEmail?.members) {
    const member = memberEmail.members as unknown as { id: string; name: string };
    if (member.id !== excludeMemberId) {
      return { existingMember: { id: member.id, name: member.name } };
    }
    // Email already belongs to this member
    return { existingMember: { id: member.id, name: member.name } };
  }

  const { data: apps } = await supabase
    .from("applications")
    .select("id, status")
    .eq("email", email.toLowerCase())
    .in("status", ["pending", "rejected"])
    .order("submitted_on", { ascending: false });

  const pending = apps?.find((a) => a.status === "pending");
  const rejected = apps?.find((a) => a.status === "rejected");

  return {
    pendingApp: pending ? { id: pending.id } : undefined,
    rejectedApp: rejected ? { id: rejected.id } : undefined,
  };
}
