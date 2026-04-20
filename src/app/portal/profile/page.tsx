import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import ProfileForm from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Fetch member data
  const { data: memberEmail } = await admin
    .from("member_emails")
    .select(
      "members!inner(id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetypes, current_intro, current_ask, contact_preference, kicked_out)"
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
    contact_preference: string | null;
    kicked_out: boolean;
  } | null;

  if (!member || member.kicked_out) redirect("/portal");

  // Get primary email
  const { data: emails } = await admin
    .from("member_emails")
    .select("email, is_primary")
    .eq("member_id", member.id);

  const primaryEmail =
    emails?.find((e) => e.is_primary)?.email ?? user.email!;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h2 className="mb-6 text-2xl font-bold text-gray-900">
        Update Your Profile
      </h2>
      <div className="rounded-lg border bg-white p-6">
        <ProfileForm
          member={{
            firstName: member.first_name,
            lastName: member.last_name,
            companyName: member.company_name,
            companyWebsite: member.company_website,
            linkedinProfile: member.linkedin_profile,
            attendeeStagetypes: member.attendee_stagetypes ?? [],
            currentIntro: member.current_intro,
            currentAsk: member.current_ask,
            contactPreference: member.contact_preference,
            primaryEmail,
          }}
        />
      </div>
    </div>
  );
}
