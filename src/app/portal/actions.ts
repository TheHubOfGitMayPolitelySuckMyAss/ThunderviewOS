"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { safePushMember } from "@/lib/streak/safe-push";
import { summarizeChangedFields } from "@/lib/summarize-profile";

export async function savePortalProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = await createAdminClientForCurrentActor();

  const result = await findMemberByAnyEmail<{
    id: string;
    current_intro: string | null;
    current_ask: string | null;
    current_give: string | null;
    contact_preference: string | null;
  }>(admin, user.email!, "id, current_intro, current_ask, current_give, contact_preference");

  const member = result?.member ?? null;
  if (!member) return { success: false, error: "Member not found" };

  const newIntro = formData.get("current_intro") as string | null;
  const newAsk = formData.get("current_ask") as string | null;
  const newGive = formData.get("current_give") as string | null;
  const newContact = formData.get("contact_preference") as string | null;

  // Normalize: treat empty strings as null, enforce length limits
  const normalizedIntro = newIntro?.trim() || null;
  const normalizedAsk = newAsk?.trim() || null;
  const normalizedGive = newGive?.trim() || null;

  if (normalizedIntro && normalizedIntro.length > 1000) {
    return { success: false, error: "Intro must be 1,000 characters or fewer" };
  }
  if (normalizedAsk && normalizedAsk.length > 250) {
    return { success: false, error: "Ask must be 250 characters or fewer" };
  }
  if (normalizedGive && normalizedGive.length > 500) {
    return { success: false, error: "Give must be 500 characters or fewer" };
  }
  const normalizedContact = newContact?.trim() || null;

  const oldIntro = member.current_intro?.trim() || null;
  const oldAsk = member.current_ask?.trim() || null;
  const oldGive = member.current_give?.trim() || null;
  const oldContact = member.contact_preference?.trim() || null;

  const introChanged = normalizedIntro !== oldIntro;
  const askChanged = normalizedAsk !== oldAsk;
  const giveChanged = normalizedGive !== oldGive;
  const contactChanged = normalizedContact !== oldContact;

  if (!introChanged && !askChanged && !giveChanged && !contactChanged) {
    return { success: true, noChanges: true };
  }

  const updates: Record<string, unknown> = {};

  if (introChanged) {
    updates.current_intro = normalizedIntro;
    updates.intro_updated_at = new Date().toISOString();
  }
  if (askChanged) {
    updates.current_ask = normalizedAsk;
    updates.ask_updated_at = new Date().toISOString();
  }
  if (giveChanged) {
    updates.current_give = normalizedGive;
  }
  if (contactChanged) {
    updates.contact_preference = normalizedContact;
  }

  if (introChanged || askChanged || giveChanged) {
    const shorts = await summarizeChangedFields(
      {
        ...(introChanged ? { intro: normalizedIntro } : {}),
        ...(askChanged ? { ask: normalizedAsk } : {}),
        ...(giveChanged ? { give: normalizedGive } : {}),
      },
      member.id,
    );
    Object.assign(updates, shorts);
  }

  const { error } = await admin
    .from("members")
    .update(updates)
    .eq("id", member.id);

  if (error) return { success: false, error: error.message };
  return { success: true, noChanges: false };
}

export async function promoteAuthEmailToPrimary(): Promise<
  { success: true } | { success: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { success: false, error: "Not authenticated" };

  const admin = await createAdminClientForCurrentActor();

  const lookup = await findMemberByAnyEmail<{ id: string }>(admin, user.email, "id");
  if (!lookup) return { success: false, error: "Member not found" };

  const { data: target } = await admin
    .from("member_emails")
    .select("id, is_primary, email_status")
    .eq("member_id", lookup.member.id)
    .ilike("email", user.email)
    .single();

  if (!target) return { success: false, error: "Email not on file for this member" };
  if (target.is_primary) return { success: true };
  if (target.email_status !== "active") {
    return { success: false, error: "This email is currently bounced; we can't make it primary" };
  }

  const { error } = await admin.rpc("swap_primary_email", {
    p_member_id: lookup.member.id,
    p_new_primary_email_id: target.id,
  });
  if (error) return { success: false, error: error.message };

  await safePushMember(lookup.member.id, "promote_auth_email_to_primary");

  return { success: true };
}
