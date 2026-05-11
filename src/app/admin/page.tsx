import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import DashboardAccordions from "./dashboard-accordions";
import { formatDate, formatName, getTodayMT } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Body } from "@/components/ui/typography";
import PageHeader from "@/components/page-header";

const ADMIN_EMAIL = "eric@marcoullier.com";
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

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

  // 30-day window shared by Marketing opt-outs and Email issues cards.
  // Historical events (e.g. opt-outs imported from the prior CRM, backdated
  // for separation) fall off the dashboard and are still queryable in SQL.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Marketing opt-outs (last 30 days)
  const { data: optOuts } = await supabase
    .from("members")
    .select("id, first_name, last_name, marketing_opted_out_at")
    .not("marketing_opted_out_at", "is", null)
    .gte("marketing_opted_out_at", thirtyDaysAgo)
    .order("marketing_opted_out_at", { ascending: false });

  // Email issues (HARD bounces + complaints in last 30 days). Soft
  // bounces (raw_payload.bounce.type != 'Permanent') are operational
  // noise — they're still in email_events and the scoped Member History,
  // just excluded from this dashboard surface.
  const { data: emailEventsRaw } = await supabase
    .from("email_events")
    .select("id, event_type, recipient_email, member_id, occurred_at, raw_payload, members(id, first_name, last_name)")
    .in("event_type", ["bounced", "complained"])
    .gte("occurred_at", thirtyDaysAgo)
    .order("occurred_at", { ascending: false });
  const emailEvents = (emailEventsRaw ?? []).filter((e) => {
    if (e.event_type !== "bounced") return true;
    const bounceType =
      (e.raw_payload as { data?: { bounce?: { type?: string } } } | null)?.data?.bounce?.type ?? null;
    return bounceType === "Permanent";
  });

  // Member Visits (last 7 days). Each member contributes one row per "session,"
  // where a new session starts when the gap from their previous page view
  // exceeds 4 hours. Admin (eric@) and team members are excluded.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Build the exclusion set: anyone with is_team=true, plus admin via email.
  const { data: teamRows } = await supabase
    .from("members")
    .select("id")
    .eq("is_team", true);
  const { data: adminRow } = await supabase
    .from("member_emails")
    .select("member_id")
    .eq("email", ADMIN_EMAIL)
    .maybeSingle();
  const excludedMemberIds = new Set<string>([
    ...(teamRows ?? []).map((m) => m.id as string),
    ...(adminRow?.member_id ? [adminRow.member_id as string] : []),
  ]);

  // Walk authenticated page views ASC, collapsing into 4-hour sessions per
  // member. fetchAll because a busy week can blow past the 1k PostgREST cap.
  const visitRows = await fetchAll<{ actor_id: string; occurred_at: string }>(
    (from, to) =>
      supabase
        .from("system_events")
        .select("actor_id, occurred_at")
        .eq("event_type", "page.viewed")
        .not("actor_id", "is", null)
        .gte("occurred_at", sevenDaysAgo)
        .order("occurred_at", { ascending: true })
        .range(from, to)
  );

  const lastVisitMsByMember = new Map<string, number>();
  const sessionEvents: { memberId: string; occurredAt: string }[] = [];
  for (const row of visitRows) {
    const aid = row.actor_id;
    if (!aid || excludedMemberIds.has(aid)) continue;
    const ms = new Date(row.occurred_at).getTime();
    const prev = lastVisitMsByMember.get(aid);
    if (prev === undefined || ms - prev > FOUR_HOURS_MS) {
      sessionEvents.push({ memberId: aid, occurredAt: row.occurred_at });
    }
    lastVisitMsByMember.set(aid, ms);
  }

  // Name lookup for the unique member ids that appeared.
  const sessionMemberIds = Array.from(new Set(sessionEvents.map((s) => s.memberId)));
  const { data: visitMembers } = sessionMemberIds.length
    ? await supabase
        .from("members")
        .select("id, first_name, last_name")
        .in("id", sessionMemberIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const nameById = new Map(
    (visitMembers ?? []).map((m) => [m.id, formatName(m.first_name, m.last_name)] as const)
  );

  // Display order: most recent first.
  const memberVisits = sessionEvents
    .slice()
    .reverse()
    .map((s) => ({
      id: `${s.memberId}-${s.occurredAt}`,
      memberId: s.memberId,
      name: nameById.get(s.memberId) ?? "Unknown",
      occurredAt: s.occurredAt,
    }));

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
        memberVisits={memberVisits}
      />
    </div>
  );
}
