"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { ensureAuthUsersForMember } from "@/lib/ensure-auth-user";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { safePushMember } from "@/lib/streak/safe-push";
import { summarizeChangedFields } from "@/lib/summarize-profile";
import sharp from "sharp";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const ADMIN_EMAIL = "eric@marcoullier.com";

/**
 * Standalone portal profile pic upload/remove.
 * Only touches profile_pic_url — no other member fields.
 */
export async function portalUpdateProfilePic(
  formData: FormData
): Promise<{ success: boolean; error?: string; profilePicUrl?: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = await createAdminClientForCurrentActor();

  const requestedTargetId = (formData.get("target_member_id") as string)?.trim() || null;
  const isAdmin = user.email === ADMIN_EMAIL;

  let member: { id: string; profile_pic_url: string | null } | null = null;
  if (requestedTargetId && isAdmin) {
    const { data } = await admin
      .from("members")
      .select("id, profile_pic_url")
      .eq("id", requestedTargetId)
      .single();
    member = (data as typeof member) ?? null;
  } else {
    const result = await findMemberByAnyEmail<{
      id: string;
      profile_pic_url: string | null;
    }>(admin, user.email!, "id, profile_pic_url");
    member = result?.member ?? null;
  }
  if (!member) return { success: false, error: "Member not found" };

  const file = formData.get("profile_pic") as File | null;
  const removePic = formData.get("remove_pic") === "true";

  if (removePic) {
    if (member.profile_pic_url) {
      await admin.storage.from("profile-pics").remove([`${member.id}.webp`]);
    }
    const { error } = await admin
      .from("members")
      .update({ profile_pic_url: null })
      .eq("id", member.id);
    if (error) return { success: false, error: error.message };
    return { success: true, profilePicUrl: null };
  }

  if (!file || file.size === 0) {
    return { success: false, error: "No file provided" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "Image must be under 5MB" };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: "Image must be JPEG, PNG, WebP, or HEIC" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await sharp(buffer)
    .resize(400, 400, { fit: "cover", position: "centre" })
    .webp({ quality: 80 })
    .rotate()
    .toBuffer();

  const filePath = `${member.id}.webp`;
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
    .eq("id", member.id);

  if (error) return { success: false, error: error.message };
  return { success: true, profilePicUrl };
}

const VALID_STAGETYPES = [
  "Active CEO (Bootstrapping or VC-Backed)",
  "Exited CEO (Acquisition or IPO)",
  "Investor",
  "Guest (Speaker/Press/Etc)",
];

const VALID_CONTACT = ["linkedin", "email"];

type ProfileMember = {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  company_website: string | null;
  linkedin_profile: string | null;
  attendee_stagetypes: string[];
  current_intro: string | null;
  current_ask: string | null;
  current_give: string | null;
  contact_preference: string | null;
};

const PROFILE_SELECT =
  "id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetypes, current_intro, current_ask, current_give, contact_preference";

/**
 * Resolve the member whose profile is being edited.
 *
 * - No `target_member_id`, or non-admin viewer: edit self.
 * - Admin viewer + `target_member_id` present: edit that member.
 *
 * Audit attribution is independent — `createAdminClientForCurrentActor()`
 * stamps every write with the viewer's member_id, so admin saves on another
 * member's row land as actor=admin, subject=that member.
 */
async function resolveTargetMember(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  viewerEmail: string,
  requestedTargetId: string | null,
): Promise<ProfileMember | null> {
  const isAdmin = viewerEmail === ADMIN_EMAIL;
  if (requestedTargetId && isAdmin) {
    const { data } = await admin
      .from("members")
      .select(PROFILE_SELECT)
      .eq("id", requestedTargetId)
      .single();
    return (data as ProfileMember) ?? null;
  }
  const result = await findMemberByAnyEmail<ProfileMember>(
    admin,
    viewerEmail,
    PROFILE_SELECT,
  );
  return result?.member ?? null;
}

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = await createAdminClientForCurrentActor();

  const requestedTargetId = (formData.get("target_member_id") as string)?.trim() || null;
  const member = await resolveTargetMember(admin, user.email!, requestedTargetId);
  if (!member) return { success: false, error: "Member not found" };

  // Parse form data
  const newFirstName = (formData.get("first_name") as string)?.trim() || null;
  const newLastName = (formData.get("last_name") as string)?.trim() || null;
  const newCompany = (formData.get("company_name") as string)?.trim() || null;
  const newWebsite = (formData.get("company_website") as string)?.trim() || null;
  const newLinkedin = (formData.get("linkedin_profile") as string)?.trim() || null;
  const newIntro = (formData.get("current_intro") as string)?.trim() || null;
  const newAsk = (formData.get("current_ask") as string)?.trim() || null;
  const newGive = (formData.get("current_give") as string)?.trim() || null;
  const newContact = (formData.get("contact_preference") as string)?.trim() || null;

  // Validate character limits
  if (newIntro && newIntro.length > 1000) {
    return { success: false, error: "Intro must be 1,000 characters or fewer" };
  }
  if (newAsk && newAsk.length > 250) {
    return { success: false, error: "Ask must be 250 characters or fewer" };
  }
  if (newGive && newGive.length > 500) {
    return { success: false, error: "Give must be 500 characters or fewer" };
  }
  const newPrimaryEmail = (formData.get("primary_email") as string)?.trim()?.toLowerCase() || null;

  // Parse stagetypes from comma-separated hidden field
  const stagetypesRaw = formData.get("attendee_stagetypes") as string;
  const newStagetypes = stagetypesRaw
    ? stagetypesRaw.split(",").filter((s) => VALID_STAGETYPES.includes(s))
    : [];

  // Validate required fields
  if (!newFirstName) return { success: false, error: "First name is required" };

  // Validate contact_preference
  if (newContact && !VALID_CONTACT.includes(newContact)) {
    return { success: false, error: "Invalid contact preference" };
  }

  // Compare fields
  const norm = (v: string | null) => v?.trim() || null;
  const oldIntro = norm(member.current_intro);
  const oldAsk = norm(member.current_ask);
  const oldGive = norm(member.current_give);

  const introChanged = newIntro !== oldIntro;
  const askChanged = newAsk !== oldAsk;
  const giveChanged = newGive !== oldGive;

  const updates: Record<string, unknown> = {};
  let anyChange = false;

  function maybeUpdate(field: string, newVal: unknown, oldVal: unknown) {
    if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      updates[field] = newVal;
      anyChange = true;
    }
  }

  maybeUpdate("first_name", newFirstName, member.first_name);
  maybeUpdate("last_name", newLastName, member.last_name);
  maybeUpdate("company_name", newCompany, member.company_name);
  maybeUpdate("company_website", newWebsite, member.company_website);
  maybeUpdate("linkedin_profile", newLinkedin, member.linkedin_profile);
  maybeUpdate("attendee_stagetypes", newStagetypes, member.attendee_stagetypes);
  maybeUpdate("current_intro", newIntro, oldIntro);
  maybeUpdate("current_ask", newAsk, oldAsk);
  maybeUpdate("current_give", newGive, oldGive);
  maybeUpdate("contact_preference", newContact, member.contact_preference);

  if (introChanged) {
    updates.intro_updated_at = new Date().toISOString();
  }
  if (askChanged) {
    updates.ask_updated_at = new Date().toISOString();
  }

  if (introChanged || askChanged || giveChanged) {
    const shorts = await summarizeChangedFields(
      {
        ...(introChanged ? { intro: newIntro } : {}),
        ...(askChanged ? { ask: newAsk } : {}),
        ...(giveChanged ? { give: newGive } : {}),
      },
      member.id,
    );
    Object.assign(updates, shorts);
    if (Object.keys(shorts).length > 0) anyChange = true;
  }

  // Handle primary email change
  let emailChanged = false;
  if (newPrimaryEmail) {
    // Get current primary email
    const { data: emails } = await admin
      .from("member_emails")
      .select("id, email, is_primary")
      .eq("member_id", member.id);

    const currentPrimary = emails?.find((e) => e.is_primary);

    if (currentPrimary && currentPrimary.email !== newPrimaryEmail) {
      emailChanged = true;

      // Check if the new email already exists in this member's emails
      const existingRow = emails?.find((e) => e.email === newPrimaryEmail);

      if (existingRow) {
        // Flip primary to existing row
        const { error: swapError } = await admin.rpc("swap_primary_email", {
          p_member_id: member.id,
          p_new_primary_email_id: existingRow.id,
        });
        if (swapError)
          return { success: false, error: swapError.message };
      } else {
        // Insert new email row and flip primary
        const { data: newRow, error: insertError } = await admin
          .from("member_emails")
          .insert({
            member_id: member.id,
            email: newPrimaryEmail,
            is_primary: false,
            source: "manual",
            email_status: "active",
          })
          .select("id")
          .single();

        if (insertError)
          return { success: false, error: insertError.message };

        const { error: swapError } = await admin.rpc("swap_primary_email", {
          p_member_id: member.id,
          p_new_primary_email_id: newRow!.id,
        });
        if (swapError)
          return { success: false, error: swapError.message };
      }

      // GoTrue needs an auth.users row per email; without this, signInWithOtp
      // against a newly-added email fails with "Signups not allowed for otp".
      await ensureAuthUsersForMember(member.id);
    }
  }

  if (!anyChange && !emailChanged) {
    return { success: true, noChanges: true };
  }

  if (anyChange) {
    const { error } = await admin
      .from("members")
      .update(updates)
      .eq("id", member.id);

    if (error) return { success: false, error: error.message };
  }

  const op =
    requestedTargetId && user.email === ADMIN_EMAIL
      ? "admin_portal_profile_save"
      : "portal_profile_save";
  await safePushMember(member.id, op);

  return { success: true, noChanges: false };
}

export async function toggleMarketing(
  value: boolean,
  targetMemberId?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = await createAdminClientForCurrentActor();

  const isAdmin = user.email === ADMIN_EMAIL;
  let memberId: string | null = null;
  if (targetMemberId && isAdmin) {
    memberId = targetMemberId;
  } else {
    const result = await findMemberByAnyEmail(admin, user.email!);
    memberId = result?.memberId ?? null;
  }
  if (!memberId) return { success: false, error: "Member not found" };

  const { error } = await admin
    .from("members")
    .update({ marketing_opted_in: value })
    .eq("id", memberId);

  if (error) return { success: false, error: error.message };

  await safePushMember(
    memberId,
    value ? "opt_back_in" : "portal_marketing_opt_out"
  );

  return { success: true };
}
