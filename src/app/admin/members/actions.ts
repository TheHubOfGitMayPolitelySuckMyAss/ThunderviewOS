"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatName } from "@/lib/format";

export type EmailCheckResult = {
  existingMember?: { id: string; name: string };
  pendingApp?: { id: string };
  rejectedApp?: { id: string };
};

export async function checkEmail(email: string): Promise<EmailCheckResult> {
  const supabase = await createClient();

  // Check member_emails for existing member
  const { data: memberEmail } = await supabase
    .from("member_emails")
    .select("member_id, members(id, first_name, last_name)")
    .eq("email", email.toLowerCase())
    .limit(1)
    .single();

  if (memberEmail?.members) {
    const member = memberEmail.members as unknown as {
      id: string;
      first_name: string;
      last_name: string;
    };
    return { existingMember: { id: member.id, name: formatName(member.first_name, member.last_name) } };
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
  const admin = createAdminClient();

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

  return { success: true, memberId: data as string };
}
