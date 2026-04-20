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
    .select("members!inner(first_name, last_name, is_team, kicked_out)")
    .eq("email", email)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    first_name: string;
    last_name: string;
    is_team: boolean;
    kicked_out: boolean;
  } | null;

  const isAdmin = email === "eric@marcoullier.com";
  const isTeam =
    !isAdmin && member?.is_team === true && member?.kicked_out === false;

  const firstInitial = member?.first_name?.[0]?.toUpperCase() ?? "?";
  const lastInitial = member?.last_name?.[0]?.toUpperCase() ?? "";
  const initials = firstInitial + lastInitial;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <TopNav initials={initials} isAdmin={isAdmin} isTeam={isTeam} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
