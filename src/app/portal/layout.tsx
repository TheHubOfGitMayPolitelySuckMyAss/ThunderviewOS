// Back-link convention:
// - Top-nav destinations (Home, Community, Recap) show NO back link —
//   the sticky top nav is how you get there, so "back" is redundant.
// - Leaf pages reached by clicking through (Tickets, Members/[id], Profile)
//   show a back link to their logical parent (usually Portal home,
//   except Members/[id] which returns to Community).

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import TopNav from "@/components/top-nav";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email!;
  const admin = createAdminClient();

  const { data: memberEmail } = await admin
    .from("member_emails")
    .select("members!inner(first_name, last_name, is_team, kicked_out, profile_pic_url)")
    .eq("email", email)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    first_name: string;
    last_name: string;
    is_team: boolean;
    kicked_out: boolean;
    profile_pic_url: string | null;
  } | null;

  const isAdmin = email === "eric@marcoullier.com";
  const isTeam =
    !isAdmin && member?.is_team === true && member?.kicked_out === false;

  const firstInitial = member?.first_name?.[0]?.toUpperCase() ?? "?";
  const lastInitial = member?.last_name?.[0]?.toUpperCase() ?? "";
  const initials = firstInitial + lastInitial;

  return (
    <div className="flex min-h-screen flex-col bg-bg tv-surface">
      <TopNav initials={initials} isAdmin={isAdmin} isTeam={isTeam} profilePicUrl={member?.profile_pic_url ?? null} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
