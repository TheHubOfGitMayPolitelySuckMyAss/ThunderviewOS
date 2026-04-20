import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDinnerDisplay, getTodayMT } from "@/lib/format";
import { getTicketInfo } from "@/lib/ticket-assignment";
import TicketPurchase from "./ticket-purchase";

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
      "email, members!inner(id, attendee_stagetypes, has_community_access, kicked_out)"
    )
    .eq("email", user.email!)
    .eq("is_primary", true)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    id: string;
    attendee_stagetypes: string[];
    has_community_access: boolean;
    kicked_out: boolean;
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

  // Fetch eligible dinners: most recent past + up to 3 months ahead
  const todayMT = getTodayMT();

  // Most recent past dinner
  const { data: pastDinner } = await admin
    .from("dinners")
    .select("id, date")
    .lt("date", todayMT)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  // Upcoming dinners within 3 months
  const threeMonthsOut = new Date();
  threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3);
  const cutoffDate = `${threeMonthsOut.getFullYear()}-${String(threeMonthsOut.getMonth() + 1).padStart(2, "0")}-${String(threeMonthsOut.getDate()).padStart(2, "0")}`;

  const { data: upcomingDinners } = await admin
    .from("dinners")
    .select("id, date")
    .gte("date", todayMT)
    .lte("date", cutoffDate)
    .order("date", { ascending: true });

  // Combine: past dinner (if any) + upcoming
  const dinnerOptions: { id: string; date: string; label: string; isPast: boolean }[] = [];

  if (pastDinner) {
    dinnerOptions.push({
      id: pastDinner.id,
      date: pastDinner.date,
      label: formatDinnerDisplay(pastDinner.date),
      isPast: true,
    });
  }

  for (const d of upcomingDinners || []) {
    dinnerOptions.push({
      id: d.id,
      date: d.date,
      label: formatDinnerDisplay(d.date),
      isPast: false,
    });
  }

  if (dinnerOptions.length === 0) {
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

  // Default to first upcoming (non-past) dinner
  const defaultDinnerId =
    dinnerOptions.find((d) => !d.isPast)?.id || dinnerOptions[0].id;

  const { label, price } = getTicketInfo(
    member.attendee_stagetypes,
    member.has_community_access
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">Buy Your Ticket</h1>
        <p className="mt-2 text-sm text-gray-500">
          Mercury Cafe, Denver, 6p&ndash;9p
        </p>

        <TicketPurchase
          dinnerOptions={dinnerOptions}
          defaultDinnerId={defaultDinnerId}
          ticketLabel={label}
          ticketPrice={price}
          memberEmail={memberEmail!.email}
        />

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
