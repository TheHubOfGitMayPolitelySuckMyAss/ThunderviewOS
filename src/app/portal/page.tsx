import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import SignOutButton from "./sign-out-button";

export default async function PortalPage() {
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

    const member =
      (memberRow?.members as unknown as {
        is_team: boolean;
        kicked_out: boolean;
      }) ?? null;
    isTeam = member?.is_team === true && member?.kicked_out === false;
  }

  const showAdminButton = isAdmin || isTeam;

  // Check if user is a member (not kicked out) for ticket link
  let isMember = false;
  if (!isAdmin) {
    const { data: memRow } = await supabase
      .from("member_emails")
      .select("members!inner(kicked_out)")
      .eq("email", email)
      .limit(1)
      .single();
    const mem = memRow?.members as unknown as { kicked_out: boolean } | null;
    isMember = mem !== null && mem.kicked_out === false;
  } else {
    isMember = true;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Portal</h1>
        <p className="mt-2 text-gray-500">
          Portal coming soon. We&rsquo;ll build this out over the next few
          sessions.
        </p>
        <p className="mt-1 text-sm text-gray-400">Signed in as {email}</p>

        <div className="mt-6 flex flex-col items-center gap-3">
          {isMember && (
            <Link
              href="/portal/tickets"
              className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Buy Your Ticket
            </Link>
          )}
          {showAdminButton && (
            <Link
              href="/admin"
              className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Go to admin &rarr;
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
