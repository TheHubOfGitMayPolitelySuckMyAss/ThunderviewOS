import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDinnerDisplay } from "@/lib/format";
import ConfettiEffect from "@/app/apply/thanks/confetti";

export default async function TicketSuccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Look up member's most recent ticket to show dinner date
  const { data: memberEmail } = await supabase
    .from("member_emails")
    .select("members!inner(id)")
    .eq("email", user.email!)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as { id: string } | null;

  let dinnerDateDisplay = "an upcoming dinner";
  if (member) {
    const { data: latestTicket } = await supabase
      .from("tickets")
      .select("dinners(date)")
      .eq("member_id", member.id)
      .order("purchased_at", { ascending: false })
      .limit(1)
      .single();

    const dinner = latestTicket?.dinners as unknown as {
      date: string;
    } | null;
    if (dinner?.date) {
      dinnerDateDisplay = formatDinnerDisplay(dinner.date);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Ticket Purchased!
        </h1>
        <p className="text-sm leading-relaxed text-gray-700">
          See you at {dinnerDateDisplay} at the Mercury Cafe. We&rsquo;ll send a
          reminder a few days before with logistics.
        </p>
        <Link
          href="/portal"
          className="mt-6 inline-block rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Back to portal
        </Link>
      </div>
      <ConfettiEffect />
    </div>
  );
}
