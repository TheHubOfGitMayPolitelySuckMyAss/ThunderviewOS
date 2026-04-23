import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatName, formatStageType } from "@/lib/format";
import MemberAvatar from "@/components/member-avatar";
import { H1, Eyebrow } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  // Fetch member
  const { data: member } = await admin
    .from("members")
    .select(
      "id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetypes, current_intro, current_ask, contact_preference, has_community_access, kicked_out, profile_pic_url"
    )
    .eq("id", id)
    .single();

  // 404 if member not found, kicked out, or no community access
  if (!member || member.kicked_out || !member.has_community_access) {
    notFound();
  }

  // Get primary email
  const { data: emails } = await admin
    .from("member_emails")
    .select("email, is_primary")
    .eq("member_id", member.id);

  const primaryEmail = emails?.find((e) => e.is_primary)?.email ?? null;

  // Check if viewer is looking at their own profile
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isSelf = false;
  if (user?.email) {
    const { data: viewerEmail } = await admin
      .from("member_emails")
      .select("member_id")
      .eq("email", user.email)
      .limit(1)
      .single();
    isSelf = viewerEmail?.member_id === member.id;
  }

  const name = formatName(member.first_name, member.last_name);
  const roles = (member.attendee_stagetypes ?? []) as string[];

  return (
    <div className="max-w-[980px] mx-auto tv-page-gutter py-7">
      <Link href="/portal/community" className="text-[13px] text-fg3 no-underline inline-flex items-center gap-1 mb-3">
        <ArrowLeft size={14} /> Community
      </Link>

      <div className="flex items-center gap-5 mt-3 mb-5">
        <MemberAvatar member={member} size="lg" />
        <div className="flex-1">
          <H1 className="!m-0">{name}</H1>
          {member.company_name && (
            <p className="text-base text-fg2 mt-1">
              CEO at{" "}
              {member.company_website ? (
                <a
                  href={member.company_website.startsWith("http") ? member.company_website : `https://${member.company_website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-hover underline decoration-border"
                >
                  {member.company_name}
                </a>
              ) : (
                member.company_name
              )}
            </p>
          )}
          <p className="text-[13px] text-fg3 mt-1">
            {roles.length > 0 ? roles.map(formatStageType).join(" \u00B7 ") : "Member"}
          </p>
          {isSelf && (
            <Link href="/portal/profile" className="no-underline mt-2.5 inline-block">
              <Button variant="secondary" size="sm">Edit Profile</Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        {member.current_intro && (
          <>
            <Eyebrow>Intro</Eyebrow>
            <p className="text-[15px] text-fg2 leading-[1.6] mt-1 mb-5 whitespace-pre-wrap">
              {member.current_intro}
            </p>
          </>
        )}

        {member.current_ask && (
          <>
            <Eyebrow>Ask</Eyebrow>
            <p className="text-[15px] text-fg2 leading-[1.6] mt-1 mb-5 whitespace-pre-wrap">
              {member.current_ask}
            </p>
          </>
        )}

        <Eyebrow>Contact</Eyebrow>
        <p className="text-[14.5px] mt-1">
          {member.linkedin_profile && (
            <a
              href={member.linkedin_profile.startsWith("http") ? member.linkedin_profile : `https://${member.linkedin_profile}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-hover underline decoration-border"
            >
              LinkedIn
            </a>
          )}
          {member.linkedin_profile && member.company_website && (
            <span className="text-fg4 mx-1.5">&middot;</span>
          )}
          {member.company_website && (
            <a
              href={member.company_website.startsWith("http") ? member.company_website : `https://${member.company_website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-hover underline decoration-border"
            >
              {member.company_website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </p>
      </Card>
    </div>
  );
}
