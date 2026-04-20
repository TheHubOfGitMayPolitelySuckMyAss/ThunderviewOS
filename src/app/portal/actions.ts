"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function savePortalProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  // Look up member
  const { data: memberEmail } = await admin
    .from("member_emails")
    .select("members!inner(id, current_intro, current_ask, contact_preference)")
    .eq("email", user.email!)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    id: string;
    current_intro: string | null;
    current_ask: string | null;
    contact_preference: string | null;
  } | null;

  if (!member) return { success: false, error: "Member not found" };

  const newIntro = formData.get("current_intro") as string | null;
  const newAsk = formData.get("current_ask") as string | null;
  const newContact = formData.get("contact_preference") as string | null;

  // Normalize: treat empty strings as null
  const normalizedIntro = newIntro?.trim() || null;
  const normalizedAsk = newAsk?.trim() || null;
  const normalizedContact = newContact?.trim() || null;

  const oldIntro = member.current_intro?.trim() || null;
  const oldAsk = member.current_ask?.trim() || null;
  const oldContact = member.contact_preference?.trim() || null;

  const introChanged = normalizedIntro !== oldIntro;
  const askChanged = normalizedAsk !== oldAsk;
  const contactChanged = normalizedContact !== oldContact;

  if (!introChanged && !askChanged && !contactChanged) {
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
  if (contactChanged) {
    updates.contact_preference = normalizedContact;
  }

  const { error } = await admin
    .from("members")
    .update(updates)
    .eq("id", member.id);

  if (error) return { success: false, error: error.message };
  return { success: true, noChanges: false };
}
