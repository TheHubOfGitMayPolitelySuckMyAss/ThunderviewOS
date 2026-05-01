"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendNewApplicationNotification } from "@/lib/email-send";
import { safePushApplication } from "@/lib/streak/safe-push";

export async function submitApplication(formData: {
  firstName: string;
  lastName: string;
  email: string;
  linkedinProfile: string;
  gender: string;
  race: string;
  orientation: string;
  companyName: string;
  companyWebsite: string;
  attendeeStagetype: string;
  iAmCeo: string | null;
  isNotServices: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin.from("applications").insert({
    first_name: formData.firstName.trim(),
    last_name: formData.lastName.trim(),
    email: formData.email.trim().toLowerCase(),
    linkedin_profile: formData.linkedinProfile.trim(),
    gender: formData.gender,
    race: formData.race,
    orientation: formData.orientation,
    company_name: formData.companyName.trim(),
    company_website: formData.companyWebsite.trim(),
    attendee_stagetype: formData.attendeeStagetype,
    i_am_my_startups_ceo: formData.iAmCeo,
    my_startup_is_not_a_services_business: formData.isNotServices,
    status: "pending",
    submitted_on: new Date().toISOString(),
    member_id: null,
  }).select("id").single();

  if (error) return { success: false, error: error.message };

  await safePushApplication(data.id, "apply_submission");

  // Notify admin — must await or serverless may terminate before send completes
  await sendNewApplicationNotification({
    id: data.id,
    firstName: formData.firstName.trim(),
    lastName: formData.lastName.trim(),
    email: formData.email.trim().toLowerCase(),
    companyName: formData.companyName.trim(),
    companyWebsite: formData.companyWebsite.trim(),
    linkedinProfile: formData.linkedinProfile.trim(),
    attendeeStagetype: formData.attendeeStagetype,
  });

  return { success: true };
}
