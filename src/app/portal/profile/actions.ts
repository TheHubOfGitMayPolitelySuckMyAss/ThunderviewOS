"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import sharp from "sharp";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const VALID_STAGETYPES = [
  "Active CEO (Bootstrapping or VC-Backed)",
  "Exited CEO (Acquisition or IPO)",
  "Investor",
  "Guest (Speaker/Press/Etc)",
];

const VALID_CONTACT = ["linkedin", "email"];

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  // Look up member with current values
  const { data: memberEmail } = await admin
    .from("member_emails")
    .select(
      "members!inner(id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetypes, current_intro, current_ask, current_give, contact_preference, profile_pic_url)"
    )
    .eq("email", user.email!)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
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
    profile_pic_url: string | null;
  } | null;

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

  const introChanged = newIntro !== oldIntro;
  const askChanged = newAsk !== oldAsk;

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
  maybeUpdate("current_give", newGive, norm(member.current_give));
  maybeUpdate("contact_preference", newContact, member.contact_preference);

  if (introChanged) {
    updates.intro_updated_at = new Date().toISOString();
  }
  if (askChanged) {
    updates.ask_updated_at = new Date().toISOString();
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
    }
  }

  // Handle profile pic upload
  const profilePicFile = formData.get("profile_pic") as File | null;
  const removePic = formData.get("remove_pic") === "true";

  if (removePic && member.profile_pic_url) {
    // Remove from storage
    await admin.storage.from("profile-pics").remove([`${member.id}.webp`]);
    updates.profile_pic_url = null;
    anyChange = true;
  } else if (profilePicFile && profilePicFile.size > 0) {
    // Validate size
    if (profilePicFile.size > MAX_FILE_SIZE) {
      return { success: false, error: "Image must be under 5MB" };
    }
    // Validate type
    if (!ALLOWED_TYPES.includes(profilePicFile.type)) {
      return { success: false, error: "Image must be JPEG, PNG, WebP, or HEIC" };
    }

    // Process with sharp: resize, crop, convert to webp, strip EXIF
    const buffer = Buffer.from(await profilePicFile.arrayBuffer());
    const processed = await sharp(buffer)
      .resize(400, 400, { fit: "cover", position: "centre" })
      .webp({ quality: 80 })
      .rotate() // auto-rotate based on EXIF, then strip
      .toBuffer();

    // Upload to storage (overwrite)
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

    // Build public URL with cache-bust
    const { data: urlData } = admin.storage
      .from("profile-pics")
      .getPublicUrl(filePath);

    updates.profile_pic_url = `${urlData.publicUrl}?v=${Date.now()}`;
    anyChange = true;
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

  return { success: true, noChanges: false, profilePicUrl: updates.profile_pic_url as string | null | undefined };
}
