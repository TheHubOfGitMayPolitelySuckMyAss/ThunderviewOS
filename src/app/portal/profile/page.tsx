import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { H1, Body } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
import ProfileForm from "./profile-form";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; id?: string }>;
}) {
  const { from, id: returnMemberId } = await searchParams;
  const fromMember = from === "member" && returnMemberId;
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
      "members!inner(id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetypes, current_intro, current_ask, current_give, contact_preference, kicked_out, profile_pic_url, marketing_opted_in)"
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
    kicked_out: boolean;
    profile_pic_url: string | null;
    marketing_opted_in: boolean;
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
    <div className="tv-container-portal tv-page-gutter py-7">
      <Link
        href={fromMember ? "/portal/community" : "/portal"}
        className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft size={14} /> {fromMember ? "Community" : "Portal home"}
      </Link>
      <ProfileForm
        returnTo={fromMember ? `/portal/members/${returnMemberId}` : undefined}
        member={{
          firstName: member.first_name,
          lastName: member.last_name,
          companyName: member.company_name,
          companyWebsite: member.company_website,
          linkedinProfile: member.linkedin_profile,
          attendeeStagetypes: member.attendee_stagetypes ?? [],
          currentIntro: member.current_intro,
          currentAsk: member.current_ask,
          currentGive: member.current_give,
          contactPreference: member.contact_preference,
          primaryEmail,
          profilePicUrl: member.profile_pic_url,
          marketingOptedIn: member.marketing_opted_in,
        }}
      />
    </div>
  );
}
