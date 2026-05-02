"use server";

import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { createClient } from "@/lib/supabase/server";
import { formatName } from "@/lib/format";
import { sendFulfillmentEmail } from "@/lib/email-send";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { safePushMember } from "@/lib/streak/safe-push";

export async function updateMemberField(
  memberId: string,
  field: string,
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();

  // attendee_stagetypes is a TEXT[] — the single-select admin UI sends one string.
  const writeValue: unknown =
    field === "attendee_stagetypes" ? (value ? [value] : []) : value;
  const updates: Record<string, unknown> = { [field]: writeValue };
  // intro_updated_at and ask_updated_at are NOT set by admin edits.
  // These timestamps are only set by the portal save action (Phase 4).

  const { error } = await admin
    .from("members")
    .update(updates)
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };

  await safePushMember(memberId, "admin_member_edit");
  return { success: true };
}

export async function toggleMemberFlag(
  memberId: string,
  field: "marketing_opted_in" | "is_team",
  value: boolean
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();
  const { error } = await admin
    .from("members")
    .update({ [field]: value })
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };

  // is_team doesn't affect Streak stage; only push on marketing_opted_in flips.
  if (field === "marketing_opted_in") {
    await safePushMember(
      memberId,
      value ? "opt_back_in" : "admin_marketing_opt_out"
    );
  }
  return { success: true };
}

export async function removeMember(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();
  const { error } = await admin
    .from("members")
    .update({ kicked_out: true, marketing_opted_in: false })
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };

  await safePushMember(memberId, "kick_out");

  // No explicit member.kicked_out log — audit row covers via the
  // members UPDATE with kicked_out flip.

  return { success: true };
}

export async function reinstateMember(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();
  const { error } = await admin
    .from("members")
    .update({ kicked_out: false, marketing_opted_in: true })
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };

  await safePushMember(memberId, "reinstate");

  // No explicit member.reinstated log — audit row covers via the
  // members UPDATE with kicked_out flip.

  return { success: true };
}

// Email management actions

export async function addMemberEmail(
  memberId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();
  const { error } = await admin.from("member_emails").insert({
    member_id: memberId,
    email: email.toLowerCase(),
    is_primary: false,
    source: "manual",
    email_status: "active",
  });

  if (error) return { success: false, error: error.message };

  await safePushMember(memberId, "email_change");
  return { success: true };
}

export async function deleteMemberEmail(
  emailId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();

  // Resolve member_id BEFORE the delete — once the row is gone we can't
  // join back to it.
  const { data: row } = await admin
    .from("member_emails")
    .select("member_id")
    .eq("id", emailId)
    .single();

  const { error } = await admin
    .from("member_emails")
    .delete()
    .eq("id", emailId);

  if (error) return { success: false, error: error.message };

  if (row?.member_id) {
    await safePushMember(row.member_id, "email_change");
  }
  return { success: true };
}

export async function setPrimaryEmail(
  memberId: string,
  emailId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();

  const { error } = await admin.rpc("swap_primary_email", {
    p_member_id: memberId,
    p_new_primary_email_id: emailId,
  });

  if (error) return { success: false, error: error.message };

  await safePushMember(memberId, "email_change");
  return { success: true };
}

// Apply credit — creates a fulfilled ticket and marks the oldest unredeemed credit as redeemed

import { getTargetDinner, getTicketInfo } from "@/lib/ticket-assignment";

export async function applyCredit(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();

  // Find the oldest unredeemed credit for this member
  const { data: credit } = await admin
    .from("credits")
    .select("id")
    .eq("member_id", memberId)
    .eq("status", "outstanding")
    .is("redeemed_ticket_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!credit) return { success: false, error: "No unredeemed credit found" };

  // Get member stagetypes for ticket type mapping
  const { data: member } = await admin
    .from("members")
    .select("attendee_stagetypes, has_community_access")
    .eq("id", memberId)
    .single();

  if (!member || !member.attendee_stagetypes || member.attendee_stagetypes.length === 0) {
    return { success: false, error: "Member stagetype not set" };
  }

  // Compute target dinner
  const targetDinner = await getTargetDinner(memberId, admin);
  if (!targetDinner) {
    return { success: false, error: "No upcoming dinner found" };
  }

  const { ticketType } = getTicketInfo(
    member.attendee_stagetypes,
    member.has_community_access
  );

  // Insert ticket as pending first, then update to fulfilled (to fire both triggers)
  const { data: newTicket, error: insertError } = await admin
    .from("tickets")
    .insert({
      member_id: memberId,
      dinner_id: targetDinner.id,
      ticket_type: ticketType,
      quantity: 1,
      amount_paid: 0,
      payment_source: "credit",
      fulfillment_status: "purchased",
      purchased_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !newTicket) {
    return { success: false, error: insertError?.message || "Failed to create ticket" };
  }

  // Update to fulfilled (fires trg_ticket_fulfillment_change)
  const { error: fulfillError } = await admin
    .from("tickets")
    .update({
      fulfillment_status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
    })
    .eq("id", newTicket.id);

  if (fulfillError) {
    return { success: false, error: fulfillError.message };
  }

  // Mark credit as redeemed
  const { error: creditError } = await admin
    .from("credits")
    .update({
      redeemed_ticket_id: newTicket.id,
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
    })
    .eq("id", credit.id);

  if (creditError) {
    return { success: false, error: creditError.message };
  }

  await safePushMember(memberId, "apply_credit");

  return { success: true };
}

export async function compTicket(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();

  const { data: member } = await admin
    .from("members")
    .select("attendee_stagetypes, has_community_access")
    .eq("id", memberId)
    .single();

  if (!member || !member.attendee_stagetypes || member.attendee_stagetypes.length === 0) {
    return { success: false, error: "Member stagetype not set" };
  }

  const targetDinner = await getTargetDinner(memberId, admin);
  if (!targetDinner) {
    return { success: false, error: "No upcoming dinner found" };
  }

  const { ticketType } = getTicketInfo(
    member.attendee_stagetypes,
    member.has_community_access
  );

  // Insert as pending (fires trg_ticket_insert)
  const { data: newTicket, error: insertError } = await admin
    .from("tickets")
    .insert({
      member_id: memberId,
      dinner_id: targetDinner.id,
      ticket_type: ticketType,
      quantity: 1,
      amount_paid: 0,
      payment_source: "comp",
      fulfillment_status: "purchased",
      purchased_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !newTicket) {
    return { success: false, error: insertError?.message || "Failed to create ticket" };
  }

  // Update to fulfilled (fires trg_ticket_fulfillment_change)
  const { error: fulfillError } = await admin
    .from("tickets")
    .update({
      fulfillment_status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
    })
    .eq("id", newTicket.id);

  if (fulfillError) {
    return { success: false, error: fulfillError.message };
  }

  await sendFulfillmentEmail(memberId, targetDinner.id);

  await safePushMember(memberId, "comp_ticket");

  return { success: true };
}

export async function adminUploadProfilePic(
  memberId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string; profilePicUrl?: string | null }> {
  const admin = await createAdminClientForCurrentActor();
  const sharp = (await import("sharp")).default;

  const file = formData.get("profile_pic") as File | null;
  const removePic = formData.get("remove_pic") === "true";

  if (removePic) {
    await admin.storage.from("profile-pics").remove([`${memberId}.webp`]);
    const { error } = await admin
      .from("members")
      .update({ profile_pic_url: null })
      .eq("id", memberId);
    if (error) return { success: false, error: error.message };
    return { success: true, profilePicUrl: null };
  }

  if (!file || file.size === 0) {
    return { success: false, error: "No file provided" };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "Image must be under 5MB" };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: "Image must be JPEG, PNG, WebP, or HEIC" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await sharp(buffer)
    .resize(400, 400, { fit: "cover", position: "centre" })
    .webp({ quality: 80 })
    .rotate()
    .toBuffer();

  const filePath = `${memberId}.webp`;
  const { error: uploadError } = await admin.storage
    .from("profile-pics")
    .upload(filePath, processed, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  const { data: urlData } = admin.storage
    .from("profile-pics")
    .getPublicUrl(filePath);

  const profilePicUrl = `${urlData.publicUrl}?v=${Date.now()}`;
  const { error } = await admin
    .from("members")
    .update({ profile_pic_url: profilePicUrl })
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };
  return { success: true, profilePicUrl };
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

  const result = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
  }>(supabase, email, "id, first_name, last_name");

  if (result) {
    const name = formatName(result.member.first_name, result.member.last_name);
    return { existingMember: { id: result.member.id, name } };
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
