import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatName, formatStageType } from "@/lib/format";

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
      "id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetypes, current_intro, current_ask, contact_preference, has_community_access, kicked_out"
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
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link
        href="/portal/community"
        className="mb-4 inline-block text-sm text-blue-600 hover:text-blue-800"
      >
        &larr; Back to community
      </Link>

      <div className="rounded-lg border bg-white p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{name}</h2>
            {member.company_name && (
              <p className="text-gray-500">{member.company_name}</p>
            )}
          </div>
          {isSelf && (
            <Link
              href="/portal/profile"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Edit Profile
            </Link>
          )}
        </div>

        {/* Profile details */}
        <div className="space-y-4">
          {member.company_website && (
            <DetailField label="Website">
              <a
                href={
                  member.company_website.startsWith("http")
                    ? member.company_website
                    : `https://${member.company_website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                {member.company_website}
              </a>
            </DetailField>
          )}

          {member.linkedin_profile && (
            <DetailField label="LinkedIn">
              <a
                href={
                  member.linkedin_profile.startsWith("http")
                    ? member.linkedin_profile
                    : `https://${member.linkedin_profile}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                {member.linkedin_profile}
              </a>
            </DetailField>
          )}

          {roles.length > 0 && (
            <DetailField label="Role">
              {roles.map(formatStageType).join(", ")}
            </DetailField>
          )}

          {primaryEmail && (
            <DetailField label="Email">{primaryEmail}</DetailField>
          )}

          {member.contact_preference && (
            <DetailField label="Preferred Contact">
              {member.contact_preference === "linkedin"
                ? "LinkedIn"
                : member.contact_preference === "email"
                  ? "Email"
                  : member.contact_preference}
            </DetailField>
          )}
        </div>

        {/* Intro & Ask */}
        {(member.current_intro || member.current_ask) && (
          <div className="mt-6 space-y-4 border-t pt-6">
            {member.current_intro && (
              <DetailField label="Intro">
                <p className="whitespace-pre-wrap text-gray-700">
                  {member.current_intro}
                </p>
              </DetailField>
            )}
            {member.current_ask && (
              <DetailField label="Ask">
                <p className="whitespace-pre-wrap text-gray-700">
                  {member.current_ask}
                </p>
              </DetailField>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{children}</dd>
    </div>
  );
}
