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
  } | null
): string {
  if (fulfillmentStatus === "refunded") return "Refunded";
  if (fulfillmentStatus === "credited") return "Credited";
  if (fulfillmentStatus === "pending") return "Pending";
  if (fulfillmentStatus === "fulfilled" && hasFreshIntroAsk(member))
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
    .select("*, members(id, first_name, last_name, current_intro, current_ask, ask_updated_at, last_dinner_attended, member_emails(email, is_primary))")
    .eq("dinner_id", id)
    .order("purchased_at", { ascending: false });

  const { data: applications } = await supabase
    .from("applications")
    .select("*, members(kicked_out)")
    .eq("preferred_dinner_date", dinner.date)
    .order("submitted_on", { ascending: false });

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
      member_emails: { email: string; is_primary: boolean }[];
    } | null;
    const primaryEmail =
      member?.member_emails?.find((e) => e.is_primary)?.email ??
      member?.member_emails?.[0]?.email ??
      "-";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qty: number = (ticket as any).quantity ?? 1;

    return {
      id: ticket.id,
      memberId: member?.id ?? null,
      memberName: member ? formatName(member.first_name, member.last_name) : "-",
      primaryEmail,
      displayStatus: deriveTicketStatus(ticket.fulfillment_status, member),
      fulfillmentStatus: ticket.fulfillment_status,
      purchasedAt: ticket.purchased_at,
      quantity: qty,
      amountPaid: Number(ticket.amount_paid),
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
        {["pending", "fulfilled", "refunded", "credited"].map((status) => (
          <div
            key={status}
            className="rounded-lg bg-white px-4 py-3 shadow"
          >
            <p className="text-xs uppercase text-gray-500">{status}</p>
            <p className="text-2xl font-bold text-gray-900">
              {statusCounts[status] || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Tickets (client component with actions) */}
      <DinnerTickets tickets={ticketRows} />

      {/* Applications table — only approved without tickets */}
      <div>
        <h3 className="mb-2 text-lg font-semibold text-gray-900">
          Approved Without Ticket ({filteredApplications.length})
        </h3>
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Stage/Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredApplications.map((app) => (
                <tr key={app.id} className="group relative hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <Link
                      href={`/admin/applications/${app.id}`}
                      className="after:absolute after:inset-0"
                    >
                      {formatName(app.first_name, app.last_name)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {app.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {app.company_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatStageType(app.attendee_stagetype)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(app.submitted_on)}
                  </td>
                </tr>
              ))}
              {filteredApplications.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-gray-400"
                  >
                    No approved applications without tickets.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
