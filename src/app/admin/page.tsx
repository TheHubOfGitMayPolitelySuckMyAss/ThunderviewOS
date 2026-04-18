import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import DashboardAccordions from "./dashboard-accordions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Next upcoming dinner
  const { data: nextDinner } = await supabase
    .from("dinners")
    .select("*")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .single();

  // Previous dinner (most recent past dinner, used as cutoff for "new" applications)
  const { data: prevDinner } = await supabase
    .from("dinners")
    .select("date")
    .lt("date", today)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  // Stats for next dinner
  let newAppsSinceLastDinner = 0;
  let ticketsSold = 0;

  if (nextDinner) {
    // Applications submitted after the last dinner date
    const appCutoff = prevDinner?.date ?? "1970-01-01";
    const { count: appCount } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .gt("submitted_on", appCutoff);
    newAppsSinceLastDinner = appCount ?? 0;

    // Tickets sold for next dinner
    const { count: ticketCount } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("dinner_id", nextDinner.id);
    ticketsSold = ticketCount ?? 0;
  }

  // Days until next dinner
  let daysUntil: number | null = null;
  if (nextDinner) {
    const dinnerDate = new Date(nextDinner.date + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    daysUntil = Math.round(
      (dinnerDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Pending applications
  const { data: pendingApps } = await supabase
    .from("applications")
    .select("id, name, company_name, submitted_on")
    .eq("status", "pending")
    .order("submitted_on", { ascending: false });

  // Unfulfilled tickets (anything not fulfilled)
  const { data: unfulfilledTickets } = await supabase
    .from("tickets")
    .select(
      "id, purchased_at, fulfillment_status, buyer_email, member_id, members(name, kicked_out, member_emails(email, is_primary)), dinner_id, dinners(date)"
    )
    .neq("fulfillment_status", "fulfilled")
    .order("purchased_at", { ascending: false });

  // Check which unfulfilled ticket buyer_emails have pending/rejected applications
  const buyerEmails = (unfulfilledTickets || [])
    .map((t) => t.buyer_email)
    .filter(Boolean) as string[];
  let appStatusByEmail: Record<string, string> = {};
  if (buyerEmails.length > 0) {
    const { data: relatedApps } = await supabase
      .from("applications")
      .select("email, status")
      .in("email", buyerEmails);
    for (const app of relatedApps || []) {
      // Keep the "worst" status: rejected > pending > approved
      const existing = appStatusByEmail[app.email];
      if (!existing || app.status === "rejected" || (app.status === "pending" && existing !== "rejected")) {
        appStatusByEmail[app.email] = app.status;
      }
    }
  }

  // Marketing opt-outs
  const { data: optOuts } = await supabase
    .from("members")
    .select("id, name, marketing_opted_out_at")
    .not("marketing_opted_out_at", "is", null)
    .order("marketing_opted_out_at", { ascending: false });

  // Derive unfulfilled reason for each ticket
  const unfulfilledWithReason = (unfulfilledTickets || []).map((ticket) => {
    const member = ticket.members as unknown as {
      name: string;
      kicked_out: boolean;
      member_emails: { email: string; is_primary: boolean }[];
    } | null;
    const dinner = ticket.dinners as unknown as { date: string } | null;

    let reason = "";
    if (!ticket.member_id || !member) {
      reason = "No member match";
    } else if (member.kicked_out) {
      reason = "Kicked out";
    } else if (ticket.buyer_email && appStatusByEmail[ticket.buyer_email] === "rejected") {
      reason = "Rejected applicant";
    } else if (ticket.buyer_email && appStatusByEmail[ticket.buyer_email] === "pending") {
      reason = "Pending applicant";
    } else if (ticket.fulfillment_status === "refunded") {
      reason = "Refunded";
    } else if (ticket.fulfillment_status === "credited") {
      reason = "Credited";
    }

    const displayName =
      member?.name ?? ticket.buyer_email ?? "Unknown";
    const displayEmail =
      member?.member_emails?.find((e) => e.is_primary)?.email ??
      member?.member_emails?.[0]?.email ??
      ticket.buyer_email ??
      "-";

    return {
      id: ticket.id,
      displayName,
      displayEmail,
      purchasedAt: ticket.purchased_at,
      dinnerDate: dinner?.date ?? null,
      fulfillmentStatus: ticket.fulfillment_status,
      reason,
    };
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>

      {/* Key stats */}
      {nextDinner ? (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg bg-white px-4 py-4 shadow">
            <p className="text-xs uppercase text-gray-500">Next Dinner</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {new Date(nextDinner.date + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric", year: "numeric" }
              )}
            </p>
          </div>
          <div className="rounded-lg bg-white px-4 py-4 shadow">
            <p className="text-xs uppercase text-gray-500">Days Until</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {daysUntil === 0 ? "Today" : daysUntil}
            </p>
          </div>
          <div className="rounded-lg bg-white px-4 py-4 shadow">
            <p className="text-xs uppercase text-gray-500">
              New Apps Since Last Dinner
            </p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {newAppsSinceLastDinner}
            </p>
          </div>
          <div className="rounded-lg bg-white px-4 py-4 shadow">
            <p className="text-xs uppercase text-gray-500">Tickets Sold</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {ticketsSold}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No upcoming dinners found.</p>
      )}

      {/* Accordion sections */}
      <DashboardAccordions
        pendingApps={pendingApps || []}
        unfulfilledTickets={unfulfilledWithReason}
        optOuts={
          (optOuts || []).map((m) => ({
            id: m.id,
            name: m.name,
            marketingOptedOutAt: m.marketing_opted_out_at,
          }))
        }
      />
    </div>
  );
}
