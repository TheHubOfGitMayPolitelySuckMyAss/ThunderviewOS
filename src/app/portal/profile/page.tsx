import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/ui/typography";
import ProfileForm from "./profile-form";

const ADMIN_EMAIL = "eric@marcoullier.com";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; id?: string; member_id?: string }>;
}) {
  const { from, id: returnMemberId, member_id: targetMemberIdParam } = await searchParams;
  const fromMember = from === "member" && returnMemberId;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = user.email === ADMIN_EMAIL;
  const admin = createAdminClient("read-only");

  // Look up the viewer's own member row first (always need it for primary email
  // fallback and to decide whether targetMemberIdParam refers to someone else).
  const viewerLookup = await findMemberByAnyEmail<{ id: string }>(
    admin,
    user.email!,
    "id",
  );
  const viewerMemberId = viewerLookup?.memberId ?? null;

  // Resolve target: if admin passed ?member_id=X and X != viewer's own id, edit
  // that member. Non-admin attempts at ?member_id are silently ignored — the
  // page will load the viewer's own profile.
  const adminEditingOther =
    !!targetMemberIdParam && isAdmin && targetMemberIdParam !== viewerMemberId;

  let memberId: string | null = null;
  if (adminEditingOther) {
    memberId = targetMemberIdParam!;
  } else if (viewerMemberId) {
    memberId = viewerMemberId;
  }

  if (!memberId) redirect("/portal");

  const { data: member } = await admin
    .from("members")
    .select(
      "id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetypes, current_intro, current_ask, current_give, contact_preference, kicked_out, profile_pic_url, marketing_opted_in",
    )
    .eq("id", memberId)
    .single();

  if (!member || (!adminEditingOther && member.kicked_out)) redirect("/portal");

  const { data: emails } = await admin
    .from("member_emails")
    .select("email, is_primary")
    .eq("member_id", member.id);

  const primaryEmail =
    emails?.find((e) => e.is_primary)?.email ??
    (adminEditingOther ? "" : user.email!);

  // Where to send the user back / redirect on save.
  // - admin editing another member: back to that member's profile page
  // - viewer with from=member&id=X: existing self-edit-from-member-page flow
  //   (back link → /portal/community, post-save → /portal/members/X)
  // - otherwise: portal home
  const backHref = adminEditingOther
    ? `/portal/members/${member.id}`
    : fromMember
      ? "/portal/community"
      : "/portal";
  const backLabel = adminEditingOther
    ? `Back to ${member.first_name}'s profile`
    : fromMember
      ? "Community"
      : "Portal home";
  const returnTo = adminEditingOther
    ? `/portal/members/${member.id}`
    : fromMember
      ? `/portal/members/${returnMemberId}`
      : undefined;

  return (
    <div className="tv-container-portal tv-page-gutter py-7">
      <Link
        href={backHref}
        className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft size={14} /> {backLabel}
      </Link>
      {adminEditingOther && (
        <div className="mb-4 rounded-lg border border-accent-soft bg-bg-elevated px-4 py-3 text-[13px] text-fg2">
          <Eyebrow className="mb-1">Admin mode</Eyebrow>
          You are editing {member.first_name} {member.last_name}&rsquo;s profile.
          The change will be attributed to you in the activity feed.
        </div>
      )}
      <ProfileForm
        returnTo={returnTo}
        targetMemberId={adminEditingOther ? member.id : null}
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
