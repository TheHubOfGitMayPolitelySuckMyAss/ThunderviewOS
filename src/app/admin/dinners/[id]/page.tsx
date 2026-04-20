import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatName, formatStageType, getTodayMT, toDateMT } from "@/lib/format";
import DinnerTickets from "./dinner-tickets";

function hasFreshIntroAsk(member: {
  current_intro: string | null;
  current_ask: string | null;
  ask_updated_at: string | null;
  last_dinner_attended: string | null;
} | null): boolean {
  if (!member) return false;
  if (!member.current_intro || !member.current_ask) return false;
  if (!member.last_dinner_attended) return true;
  if (!member.ask_updated_at) return false;
  return member.ask_updated_at > member.last_dinner_attended;
}

function deriveTicketStatus(
  fulfillmentStatus: string,
  member: {
    current_intro: string | null;
    current_ask: string | null;
    ask_updated_at: string | null;
    last_dinner_attended: string | null;
  } | null,
  isNextUpcomingDinner: boolean
): string {
  if (fulfillmentStatus === "refunded") return "Refunded";
  if (fulfillmentStatus === "credited") return "Credited";
  if (fulfillmentStatus === "purchased") return "Purchased";
  if (fulfillmentStatus === "fulfilled" && isNextUpcomingDinner && hasFreshIntroAsk(member))
    return "Intro/Ask";
  if (fulfillmentStatus === "fulfilled") return "Fulfilled";
  return fulfillmentStatus;
}

export default async function DinnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: dinner } = await supabase
    .from("dinners")
    .select("*")
    .eq("id", id)
    .single();

  if (!dinner) {
    notFound();
  }

  const { data: tickets } = await supabase
    .from("tickets")
    .select("*, members(id, first_name, last_name, current_intro, current_ask, ask_updated_at, last_dinner_attended, profile_pic_url, member_emails(email, is_primary))")
    .eq("dinner_id", id)
    .order("purchased_at", { ascending: false });

  const { data: applications } = await supabase
    .from("applications")
    .select("*, members(kicked_out)")
    .eq("preferred_dinner_date", dinner.date)
    .order("submitted_on", { ascending: false });

  // Build map of each member's first-ever ticket purchased_at (pending/fulfilled only)
  const memberIds = [...new Set(
    (tickets || []).map((t) => t.member_id).filter(Boolean)
  )];
  const firstTicketMap: Record<string, string> = {};
  if (memberIds.length > 0) {
    // For each member on this dinner, find their earliest pending/fulfilled ticket across ALL dinners
    const { data: firstTickets } = await supabase
      .from("tickets")
      .select("member_id, purchased_at")
      .in("member_id", memberIds)
      .in("fulfillment_status", ["purchased", "fulfilled"])
      .order("purchased_at", { ascending: true });
    for (const ft of firstTickets || []) {
      if (!firstTicketMap[ft.member_id]) {
        firstTicketMap[ft.member_id] = ft.purchased_at;
      }
    }
  }

  // Count tickets by fulfillment status, summing quantity
  const statusCounts = (tickets || []).reduce(
    (acc, t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qty: number = (t as any).quantity ?? 1;
      acc[t.fulfillment_status] = (acc[t.fulfillment_status] || 0) + qty;
      return acc;
    },
    {} as Record<string, number>
  );

  // Build set of member IDs who have tickets for this dinner
  const today = getTodayMT();

  // Determine if this dinner is the next upcoming dinner (for Intro/Ask status)
  const { data: nextUpcoming } = await supabase
    .from("dinners")
    .select("date")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .single();
  const isNextUpcomingDinner = nextUpcoming?.date === dinner.date;

  const isPast = dinner.date < today;

  const ticketMemberIds = new Set(
    (tickets || [])
      .filter((t) => {
        if (isPast) {
          return t.purchased_at && toDateMT(t.purchased_at) <= dinner.date;
        }
        return true;
      })
      .map((t) => t.member_id)
      .filter(Boolean)
  );

  const filteredApplications = (applications || []).filter((app) => {
    if (app.status !== "approved" || !app.member_id) return false;
    if (ticketMemberIds.has(app.member_id)) return false;
    // Exclude kicked-out members
    const m = app.members as unknown as { kicked_out: boolean } | null;
    if (m?.kicked_out === true) return false;
    return true;
  });

  // Shape ticket data for client component
  const ticketRows = (tickets || []).map((ticket) => {
    const member = ticket.members as unknown as {
      id: string;
      first_name: string;
      last_name: string;
      current_intro: string | null;
      current_ask: string | null;
      ask_updated_at: string | null;
      last_dinner_attended: string | null;
      profile_pic_url: string | null;
      member_emails: { email: string; is_primary: boolean }[];
    } | null;
    const primaryEmail =
      member?.member_emails?.find((e) => e.is_primary)?.email ??
      member?.member_emails?.[0]?.email ??
      "-";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qty: number = (ticket as any).quantity ?? 1;

    // A member's first-ever ticket is one where purchased_at matches their earliest
    const isFirstTicket = member?.id
      ? firstTicketMap[member.id] === ticket.purchased_at
      : false;

    return {
      id: ticket.id,
      memberId: member?.id ?? null,
      memberName: member ? formatName(member.first_name, member.last_name) : "-",
      memberFirstName: member?.first_name ?? "",
      memberLastName: member?.last_name ?? "",
      profilePicUrl: member?.profile_pic_url ?? null,
      primaryEmail,
      displayStatus: deriveTicketStatus(ticket.fulfillment_status, member, isNextUpcomingDinner),
      fulfillmentStatus: ticket.fulfillment_status,
      purchasedAt: ticket.purchased_at,
      quantity: qty,
      amountPaid: Number(ticket.amount_paid),
      isFirstTicket,
      paymentSource: ticket.payment_source as string,
    };
  });

  return (
    <div className="space-y-6">
      {/* Dinner header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {formatDate(dinner.date, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </h2>
        <p className="text-sm text-gray-500">Venue: {dinner.venue}</p>
      </div>

      {/* Ticket counts */}
      <div className="flex gap-4">
        <div className="rounded-lg bg-white px-4 py-3 shadow">
          <p className="text-xs uppercase text-gray-500">Purchased</p>
          <p className="text-2xl font-bold text-gray-900">
            {(statusCounts["purchased"] || 0) + (statusCounts["fulfilled"] || 0)}
          </p>
        </div>
        <div className="rounded-lg bg-white px-4 py-3 shadow">
          <p className="text-xs uppercase text-gray-500">Refunded</p>
          <p className="text-2xl font-bold text-gray-900">
            {statusCounts["refunded"] || 0}
          </p>
        </div>
        <div className="rounded-lg bg-white px-4 py-3 shadow">
          <p className="text-xs uppercase text-gray-500">Credited</p>
          <p className="text-2xl font-bold text-gray-900">
            {statusCounts["credited"] || 0}
          </p>
        </div>
      </div>

      {/* Tickets (client component with actions) */}
      <DinnerTickets tickets={ticketRows} />

    </div>
  );
}
