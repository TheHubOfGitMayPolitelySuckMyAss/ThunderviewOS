import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import TopNav from "@/components/top-nav";
import AdminShell from "./admin-shell";

export default async function AdminLayout({
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
  const isAdmin = email === "eric@marcoullier.com";

  const admin = createAdminClient();

  // Fetch member data for initials and team check
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

  let isTeam = false;
  if (!isAdmin) {
    isTeam = member?.is_team === true && member?.kicked_out === false;
    if (!isTeam) {
      redirect("/portal");
    }
  }

  const firstInitial = member?.first_name?.[0]?.toUpperCase() ?? email[0].toUpperCase();
  const lastInitial = member?.last_name?.[0]?.toUpperCase() ?? "";
  const initials = firstInitial + lastInitial;

  return (
    <div className="flex h-screen flex-col tv-surface">
      <TopNav initials={initials} isAdmin={isAdmin} isTeam={isTeam} profilePicUrl={member?.profile_pic_url ?? null} />
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
