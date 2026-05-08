import { createClient } from "@/lib/supabase/server";
import DashboardAccordions from "./dashboard-accordions";
import { formatDate, formatName, getTodayMT } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Body } from "@/components/ui/typography";
import PageHeader from "@/components/page-header";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = getTodayMT();

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
    const appCutoff = prevDinner?.date ?? "1970-01-01";
    const { count: appCount } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .gt("submitted_on", appCutoff)
      .eq("status", "pending");
    newAppsSinceLastDinner = appCount ?? 0;

    const { data: soldTickets } = await supabase
      .from("tickets")
      .select("quantity")
      .eq("dinner_id", nextDinner.id)
      .in("fulfillment_status", ["purchased", "fulfilled"]);
    ticketsSold = (soldTickets || []).reduce((sum, t) => sum + (t.quantity ?? 1), 0);
  }

  // Days until next dinner
  let daysUntil: number | null = null;
  if (nextDinner) {
    const dinnerMs = new Date(nextDinner.date + "T00:00:00").getTime();
    const todayMs = new Date(today + "T00:00:00").getTime();
    daysUntil = Math.round((dinnerMs - todayMs) / (1000 * 60 * 60 * 24));
  }

  // Pending applications
  const { data: pendingApps } = await supabase
    .from("applications")
    .select("id, first_name, last_name, company_name, submitted_on, email")
    .eq("status", "pending")
    .order("submitted_on", { ascending: false });

  // Flag any pending applications whose email belongs to a kicked-out member.
  // Public submission already short-circuits matches against active members,
  // so anything that lands here with an existing-email match is a re-application
  // from someone we previously removed and needs deliberate review.
  const pendingEmails = (pendingApps || []).map((a) => a.email.toLowerCase());
  const kickedOutEmails = new Set<string>();
  if (pendingEmails.length > 0) {
    const { data: emailRows } = await supabase
      .from("member_emails")
      .select("email, members(kicked_out)")
      .in("email", pendingEmails);
    for (const row of emailRows || []) {
      const m = row.members as unknown as { kicked_out: boolean } | null;
      if (m?.kicked_out) kickedOutEmails.add(row.email.toLowerCase());
    }
  }

  // Active community members
  const { count: communityCount } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("has_community_access", true)
    .eq("kicked_out", false);

  // Marketing opt-outs
  const { data: optOuts } = await supabase
    .from("members")
    .select("id, first_name, last_name, marketing_opted_out_at")
    .not("marketing_opted_out_at", "is", null)
    .order("marketing_opted_out_at", { ascending: false });

  // Email issues (bounces + complaints in last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: emailEvents } = await supabase
    .from("email_events")
    .select("id, event_type, recipient_email, member_id, occurred_at, members(id, first_name, last_name)")
    .in("event_type", ["bounced", "complained"])
    .gte("occurred_at", thirtyDaysAgo)
    .order("occurred_at", { ascending: false });

  return (
    <div className="tv-container-admin">
      <PageHeader
        title="Dashboard"
        size="compact"
      />

      {/* Key stats */}
      {nextDinner ? (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="tv-eyebrow mb-2">Days until</div>
            <div className="font-display font-medium text-[40px] leading-none text-fg1 mb-1" style={{ fontVariationSettings: '"opsz" 72' }}>
              {daysUntil === 0 ? "Today" : daysUntil}
            </div>
            <div className="text-[12px] text-fg3">
              {formatDate(nextDinner.date, { month: "short", day: "numeric" })} &middot; {nextDinner.venue || "ID345"}
            </div>
          </Card>
          <Card>
            <div className="tv-eyebrow mb-2">Tickets sold</div>
            <div className="font-display font-medium text-[40px] leading-none text-fg1 mb-1" style={{ fontVariationSettings: '"opsz" 72' }}>
              {ticketsSold}
            </div>
            <div className="text-[12px] text-fg3">for next dinner</div>
          </Card>
          <Card>
            <div className="tv-eyebrow mb-2">New apps</div>
            <div className="font-display font-medium text-[40px] leading-none text-fg1 mb-1" style={{ fontVariationSettings: '"opsz" 72' }}>
              {newAppsSinceLastDinner}
            </div>
            <div className="text-[12px] text-fg3">pending review</div>
          </Card>
          <Card>
            <div className="tv-eyebrow mb-2">Community</div>
            <div className="font-display font-medium text-[40px] leading-none text-fg1 mb-1" style={{ fontVariationSettings: '"opsz" 72' }}>
              {communityCount ?? 0}
            </div>
            <div className="text-[12px] text-fg3">active members</div>
          </Card>
        </div>
      ) : (
        <Body className="text-fg3 mb-6">No upcoming dinners found.</Body>
      )}

      {/* Accordion sections */}
      <DashboardAccordions
        pendingApps={(pendingApps || []).map((a) => ({
          id: a.id,
          name: formatName(a.first_name, a.last_name),
          company_name: a.company_name,
          submitted_on: a.submitted_on,
          kickedOutReapplication: kickedOutEmails.has(a.email.toLowerCase()),
        }))}
        optOuts={
          (optOuts || []).map((m) => ({
            id: m.id,
            name: formatName(m.first_name, m.last_name),
            marketingOptedOutAt: m.marketing_opted_out_at,
          }))
        }
        emailIssues={
          (emailEvents || []).map((e) => {
            const m = e.members as unknown as { id: string; first_name: string; last_name: string } | null;
            return {
              id: e.id,
              eventType: e.event_type as "bounced" | "complained",
              recipientEmail: e.recipient_email,
              memberId: m?.id ?? null,
              memberName: m ? formatName(m.first_name, m.last_name) : null,
              occurredAt: e.occurred_at,
            };
          })
        }
      />
    </div>
  );
}
