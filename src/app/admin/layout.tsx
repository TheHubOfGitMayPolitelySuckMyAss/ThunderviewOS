import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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

  let isTeam = false;
  if (!isAdmin) {
    const { data: memberRow } = await supabase
      .from("member_emails")
      .select("members!inner(is_team, kicked_out)")
      .eq("email", email)
      .limit(1)
      .single();

    const member = (memberRow?.members as unknown as { is_team: boolean; kicked_out: boolean }) ?? null;
    isTeam = member?.is_team === true && member?.kicked_out === false;

    if (!isTeam) {
      redirect("/portal");
    }
  }

  return (
    <AdminShell email={email} role={isAdmin ? "Admin" : "Team"}>
      {children}
    </AdminShell>
  );
}
