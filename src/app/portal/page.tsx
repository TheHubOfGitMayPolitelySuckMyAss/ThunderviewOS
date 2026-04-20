import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import PortalForm from "./portal-form";

export default async function PortalPage() {
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
    .select(
      "members!inner(id, first_name, kicked_out, current_intro, current_ask, contact_preference)"
    )
    .eq("email", email)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    id: string;
    first_name: string;
    kicked_out: boolean;
    current_intro: string | null;
    current_ask: string | null;
    contact_preference: string | null;
  } | null;

  const isMember = member !== null && member.kicked_out === false;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h2 className="mb-6 text-2xl font-bold text-gray-900">
        {member?.first_name ? `Welcome, ${member.first_name}` : "Portal"}
      </h2>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Left column: navigation buttons */}
        <div className="flex flex-col gap-3">
          {isMember && (
            <Link
              href="/portal/tickets"
              className="rounded-md bg-gray-900 px-5 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
            >
              Buy A Dinner Ticket
            </Link>
          )}
          <Link
            href="/portal/profile"
            className="rounded-md bg-gray-900 px-5 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
          >
            Update Your Profile
          </Link>
          <Link
            href="/portal/community"
            className="rounded-md bg-gray-900 px-5 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
          >
            View The Community
          </Link>
          <Link
            href="/portal/recap"
            className="rounded-md bg-gray-900 px-5 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
          >
            Check Last Month&rsquo;s Intros &amp; Asks
          </Link>
        </div>

        {/* Right column: inline edit form */}
        {isMember && (
          <div className="rounded-lg border bg-white p-6">
            <PortalForm
              initialIntro={member.current_intro}
              initialAsk={member.current_ask}
              initialContact={member.contact_preference}
            />
          </div>
        )}
      </div>
    </div>
  );
}
