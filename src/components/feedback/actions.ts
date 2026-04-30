"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatName } from "@/lib/format";
import { sendFeedbackNotification } from "@/lib/email-feedback";

type FeedbackInput = {
  type: "Bug" | "Feedback";
  message: string;
  name?: string;
  email?: string;
  honeypot: string;
  url: string;
  referrer: string | null;
  userAgent: string;
  viewport: string;
  timestamp: string;
};

export async function submitFeedback(input: FeedbackInput): Promise<{ success: boolean }> {
  // Honeypot check — silent drop
  if (input.honeypot) {
    return { success: true };
  }

  // Validate message
  const message = input.message.trim().slice(0, 2000);
  if (!message) {
    return { success: false };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let submitterName: string;
  let submitterEmail: string;
  let memberId: string | null = null;
  let memberContext: Record<string, unknown> | null = null;
  let recentTickets: Record<string, unknown>[] = [];
  let lastApplication: Record<string, unknown> | null = null;
  let role = "anonymous";

  if (user?.email) {
    // Authenticated user — look up member
    const { data: memberEmail } = await admin
      .from("member_emails")
      .select(
        "email, email_status, member_id, members!inner(id, first_name, last_name, attendee_stagetypes, has_community_access, kicked_out, marketing_opted_in, is_team, intro_updated_at, ask_updated_at)"
      )
      .eq("email", user.email)
      .eq("is_primary", true)
      .limit(1)
      .single();

    if (memberEmail) {
      const m = memberEmail.members as unknown as {
        id: string;
        first_name: string;
        last_name: string;
        attendee_stagetypes: string[];
        has_community_access: boolean;
        kicked_out: boolean;
        marketing_opted_in: boolean;
        is_team: boolean;
        intro_updated_at: string | null;
        ask_updated_at: string | null;
      };

      memberId = m.id;
      submitterName = formatName(m.first_name, m.last_name);
      submitterEmail = memberEmail.email;

      const isAdmin = user.email === "eric@marcoullier.com";
      role = isAdmin ? "admin" : m.is_team ? "team" : "member";

      memberContext = {
        stagetypes: m.attendee_stagetypes,
        has_community_access: m.has_community_access,
        kicked_out: m.kicked_out,
        marketing_opted_in: m.marketing_opted_in,
        primary_email_status: memberEmail.email_status,
        intro_updated_at: m.intro_updated_at,
        ask_updated_at: m.ask_updated_at,
      };

      // Last 3 tickets
      const { data: tickets } = await admin
        .from("tickets")
        .select("fulfillment_status, purchased_at, payment_source, amount_paid, dinners!inner(date)")
        .eq("member_id", m.id)
        .order("purchased_at", { ascending: false })
        .limit(3);

      recentTickets = (tickets ?? []).map((t) => ({
        status: t.fulfillment_status,
        dinner_date: (t.dinners as unknown as { date: string }).date,
        payment_source: t.payment_source,
        amount_paid: t.amount_paid,
      }));

      // Last application
      const { data: app } = await admin
        .from("applications")
        .select("status, submitted_on")
        .eq("member_id", m.id)
        .order("submitted_on", { ascending: false })
        .limit(1)
        .single();

      if (app) {
        lastApplication = { status: app.status, submitted_on: app.submitted_on };
      }
    } else {
      submitterName = user.email;
      submitterEmail = user.email;
    }
  } else {
    // Anonymous
    submitterName = input.name?.trim() || "Anonymous";
    submitterEmail = input.email?.trim() || "";
    if (!submitterEmail) return { success: false };
  }

  await sendFeedbackNotification({
    type: input.type,
    message,
    submitterName,
    submitterEmail,
    memberId,
    role,
    memberContext,
    recentTickets,
    lastApplication,
    pageUrl: input.url,
    referrer: input.referrer,
    userAgent: input.userAgent,
    viewport: input.viewport,
    timestamp: input.timestamp,
  });

  return { success: true };
}
