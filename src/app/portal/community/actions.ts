"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { findMemberByAnyEmail } from "@/lib/member-lookup";

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

  return { success: true };
}
