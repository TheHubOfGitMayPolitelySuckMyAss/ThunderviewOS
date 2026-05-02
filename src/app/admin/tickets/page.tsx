import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { formatName, formatDinnerDisplay } from "@/lib/format";
import TicketsTable from "./tickets-table";
import PageHeader from "@/components/page-header";

export default async function TicketsPage() {
  const supabase = await createClient();

  const tickets = await fetchAll<{
    id: string;
    purchased_at: string;
    ticket_type: string;
    payment_source: string;
    fulfillment_status: string;
    amount_paid: number;
    quantity: number;
    dinner_id: string;
    member_id: string | null;
    members: unknown;
    dinners: unknown;
  }>((from, to) =>
    supabase
      .from("tickets")
      .select(
        "id, purchased_at, ticket_type, payment_source, fulfillment_status, amount_paid, quantity, dinner_id, member_id, members(first_name, last_name, kicked_out), dinners(date)"
      )
      .order("purchased_at", { ascending: false })
      .range(from, to),
  );

  const rows = tickets.map((t) => {
    const member = t.members as { first_name: string; last_name: string; kicked_out: boolean } | null;
    const dinner = t.dinners as { date: string } | null;
    return {
      id: t.id,
      purchasedAt: t.purchased_at,
      memberName: member ? formatName(member.first_name, member.last_name) : "-",
      memberFirstName: member?.first_name ?? "",
      memberLastName: member?.last_name ?? "",
      kickedOut: member?.kicked_out ?? false,
      dinnerDate: dinner?.date ?? "",
      dinnerDisplay: dinner?.date ? formatDinnerDisplay(dinner.date) : "-",
      dinnerId: t.dinner_id,
      quantity: t.quantity ?? 1,
      amountPaid: Number(t.amount_paid),
      ticketType: t.ticket_type,
      paymentSource: t.payment_source,
      fulfillmentStatus: t.fulfillment_status,
    };
  });

  return (
    <div className="tv-container-admin">
      <PageHeader
        title="Tickets"
        size="compact"
        actions={<span className="text-fg3 text-[14px]">{rows.length} total</span>}
      />
      <TicketsTable tickets={rows} />
    </div>
  );
}
