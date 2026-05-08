import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { H1, Lede } from "@/components/ui/typography";
import { redirect } from "next/navigation";
import CommunityTestTable from "./community-test-table";

export default async function CommunityTestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const email = user.email!;
  const isAdmin = email === "eric@marcoullier.com";

  const admin = createAdminClient("read-only");

  if (!isAdmin) {
    const result = await findMemberByAnyEmail<{ is_team: boolean; kicked_out: boolean }>(
      admin,
      email,
      "is_team, kicked_out",
    );
    const isTeam = result?.member.is_team === true && result.member.kicked_out === false;
    if (!isTeam) redirect("/portal/community");
  }

  const members = await fetchAll((from, to) =>
    admin
      .from("members")
      .select(
        "id, first_name, last_name, company_name, company_website, linkedin_profile, attendee_stagetypes, current_intro, current_ask, current_give, current_intro_short, current_ask_short, current_give_short, contact_preference, profile_pic_url",
      )
      .eq("has_community_access", true)
      .eq("kicked_out", false)
      .order("first_name", { ascending: true })
      .range(from, to),
  );

  return (
    <div className="tv-container-portal tv-page-gutter py-7">
      <H1 className="mb-1.5">Community (test)</H1>
      <Lede className="mb-6">
        {members.length} members. Iterating on summary columns — only visible to admin/team.
      </Lede>
      <CommunityTestTable members={members} />
    </div>
  );
}
