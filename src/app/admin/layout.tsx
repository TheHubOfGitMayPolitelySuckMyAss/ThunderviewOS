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
    const { data: member } = await supabase
      .from("members")
      .select("is_team, kicked_out")
      .eq("email", email)
      .single();
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
