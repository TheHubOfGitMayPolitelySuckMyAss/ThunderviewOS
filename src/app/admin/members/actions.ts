"use server";

import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { createClient } from "@/lib/supabase/server";
import { formatName } from "@/lib/format";
import { ensureAuthUser } from "@/lib/ensure-auth-user";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { safePushMember } from "@/lib/streak/safe-push";

export type EmailCheckResult = {
  existingMember?: { id: string; name: string };
  pendingApp?: { id: string };
  rejectedApp?: { id: string };
};

export async function checkEmail(email: string): Promise<EmailCheckResult> {
  const supabase = await createClient();

  const result = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
  }>(supabase, email, "id, first_name, last_name");

  if (result) {
    return {
      existingMember: {
        id: result.member.id,
        name: formatName(result.member.first_name, result.member.last_name),
      },
    };
  }

  // Check applications for pending/rejected
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

export async function addMember(formData: {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  companyWebsite: string;
  linkedinProfile: string;
  attendeeStagetype: string;
  preferredDinnerDate: string;
  gender: string;
  race: string;
  orientation: string;
}): Promise<{ success: boolean; error?: string; memberId?: string }> {
  const admin = await createAdminClientForCurrentActor();

  const isActiveCEO =
    formData.attendeeStagetype === "Active CEO (Bootstrapping or VC-Backed)";

  const { data, error } = await admin.rpc("add_member_with_application", {
    p_first_name: formData.firstName,
    p_last_name: formData.lastName,
    p_email: formData.email.toLowerCase(),
    p_company_name: formData.companyName,
    p_company_website: formData.companyWebsite || null,
    p_linkedin_profile: formData.linkedinProfile || null,
    p_attendee_stagetype: formData.attendeeStagetype,
    p_preferred_dinner_date: formData.preferredDinnerDate,
    p_gender: formData.gender,
    p_race: formData.race,
    p_orientation: formData.orientation,
    p_i_am_ceo: isActiveCEO ? "Yes" : null,
    p_not_services: isActiveCEO ? "Yes" : null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Ensure auth.users row exists so the member can log in
  await ensureAuthUser(formData.email);

  await safePushMember(data as string, "add_member");

  // No explicit member.added log — audit row covers it via the members
  // INSERT (actor attributed via X-Audit-Actor header on this request).

  return { success: true, memberId: data as string };
}
