import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDinnerDisplay } from "@/lib/format";
import { getTargetDinner, getTicketInfo } from "@/lib/ticket-assignment";

export default async function TicketSelectionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Look up member by auth email
  const { data: memberEmail } = await admin
    .from("member_emails")
    .select(
      "members!inner(id, attendee_stagetypes, has_community_access, kicked_out, last_dinner_attended)"
    )
    .eq("email", user.email!)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    id: string;
    attendee_stagetypes: string[];
    has_community_access: boolean;
    kicked_out: boolean;
    last_dinner_attended: string | null;
  } | null;

  // Kicked out or not a member → back to portal
  if (!member || member.kicked_out) {
    redirect("/portal");
  }

  // No stagetype set
  if (!member.attendee_stagetypes || member.attendee_stagetypes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Buy Your Ticket</h1>
          <p className="mt-4 text-gray-500">
            Your profile isn&rsquo;t fully set up yet. Please contact{" "}
            <a
              href="mailto:eric@marcoullier.com"
              className="text-blue-600 hover:text-blue-800"
            >
              eric@marcoullier.com
            </a>{" "}
            for help.
          </p>
          <Link
            href="/portal"
            className="mt-6 inline-block text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Back to portal
          </Link>
        </div>
      </div>
    );
  }

  // Check for existing pending ticket
  const { data: pendingTicket } = await admin
    .from("tickets")
    .select("id, dinner_id, dinners(date)")
    .eq("member_id", member.id)
    .eq("fulfillment_status", "pending")
    .limit(1)
    .single();

  if (pendingTicket) {
    const dinner = pendingTicket.dinners as unknown as { date: string } | null;
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Buy Your Ticket</h1>
          <p className="mt-4 text-gray-500">
            You already have a ticket for{" "}
            {dinner?.date ? formatDinnerDisplay(dinner.date) : "an upcoming dinner"}.
          </p>
          <Link
            href="/portal"
            className="mt-6 inline-block text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Back to portal
          </Link>
        </div>
      </div>
    );
  }

  // Compute target dinner
  const targetDinner = await getTargetDinner(member.id, admin);

  if (!targetDinner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Buy Your Ticket</h1>
          <p className="mt-4 text-gray-500">
            No upcoming dinners available. Please contact{" "}
            <a
              href="mailto:eric@marcoullier.com"
              className="text-blue-600 hover:text-blue-800"
            >
              eric@marcoullier.com
            </a>
            .
          </p>
          <Link
            href="/portal"
            className="mt-6 inline-block text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Back to portal
          </Link>
        </div>
      </div>
    );
  }

  const { label, price } = getTicketInfo(
    member.attendee_stagetypes,
    member.has_community_access
  );

  // December dinner → guest page; otherwise → cart
  const dinnerMonth = new Date(targetDinner.date + "T00:00:00").getMonth() + 1;
  const nextHref =
    dinnerMonth === 12
      ? `/portal/tickets/guest?dinner_id=${targetDinner.id}`
      : `/portal/tickets/cart?dinner_id=${targetDinner.id}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">Buy Your Ticket</h1>
        <p className="mt-2 text-gray-500">
          {formatDinnerDisplay(targetDinner.date)}
          <br />
          Mercury Cafe, Denver, 6p&ndash;9p
        </p>

        <Link
          href={nextHref}
          className="mt-8 block rounded-lg border-2 border-gray-200 bg-white px-6 py-6 shadow-sm transition hover:border-gray-900 hover:shadow-md"
        >
          <p className="text-lg font-semibold text-gray-900">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">${price}</p>
        </Link>

        <Link
          href="/portal"
          className="mt-6 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to portal
        </Link>
      </div>
    </div>
  );
}
