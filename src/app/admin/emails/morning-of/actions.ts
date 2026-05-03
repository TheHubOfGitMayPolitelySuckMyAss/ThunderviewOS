"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { EMAIL_FROM, bodyToHtml, renderTemplateVars } from "@/lib/email";
import { formatDateFriendly, formatName, getTodayMT } from "@/lib/format";
import { type Attendee, getDinnerAttendees, buildAttendeeHtml } from "@/lib/email-intros-asks";
import { isTestingMode } from "@/lib/email-mode";
import { logSystemEvent } from "@/lib/system-events";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

const renderTemplate = renderTemplateVars;

async function getNextDinnerWithAttendees(admin: ReturnType<typeof createAdminClient>) {
  const todayMT = getTodayMT();
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date, venue, address")
    .gte("date", todayMT)
    .order("date", { ascending: true })
    .limit(1)
    .single();

  if (!dinner) return null;

  const attendees = await getDinnerAttendees(dinner.id, admin);
  return { dinner, attendees };
}

export async function sendTestEmail(
  slug: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  void slug;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient("read-only");

  const lookup = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
  }>(admin, user.email!, "id, first_name, last_name");

  if (!lookup) return { success: false, error: "Member not found" };

  const member = lookup.member;

  const result = await getNextDinnerWithAttendees(admin);
  if (!result) return { success: false, error: "No upcoming dinner found" };

  const { dinner, attendees } = result;

  const vars = {
    firstName: member.first_name,
    dinnerDate: formatDateFriendly(dinner.date),
    venue: dinner.venue,
    address: dinner.address,
  };

  const renderedSubject = renderTemplate(subject, vars);
  const renderedBody = renderTemplate(body, vars);
  const attendeeHtml = buildAttendeeHtml(attendees);
  const appendedHtml = `<hr style="border:none;border-top:1px solid #E2D7C1;margin:24px 0;"><p style="font-weight:600;margin:0 0 12px;">Tonight\u2019s Attendees</p>${attendeeHtml}`;
  const fullHtml = bodyToHtml(renderedBody, appendedHtml);

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: lookup.matchedEmail,
    subject: renderedSubject,
    html: fullHtml,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function sendToAllAttendees(
  dinnerId: string
): Promise<{ success: boolean; error?: string; sent?: number; sentAt?: string; sentByName?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = await createAdminClientForCurrentActor();

  // Get sender's member record
  const senderLookup = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
  }>(admin, user.email!, "id, first_name, last_name");

  if (!senderLookup) return { success: false, error: "Member not found" };

  const sender = senderLookup.member;

  // Get dinner details
  const { data: dinner } = await admin
    .from("dinners")
    .select("id, date, venue, address")
    .eq("id", dinnerId)
    .single();

  if (!dinner) return { success: false, error: "Dinner not found" };

  // Get fulfilled attendees
  const { data: tickets } = await admin
    .from("tickets")
    .select(
      "member_id, members!inner(id, first_name, last_name, company_name, company_website, linkedin_profile, contact_preference, current_intro, current_ask, ask_updated_at, last_dinner_attended, has_community_access, kicked_out, is_team, member_emails(email, is_primary))"
    )
    .eq("dinner_id", dinner.id)
    .eq("fulfillment_status", "fulfilled");

  type TicketRow = {
    member_id: string;
    members: Attendee & { id: string; is_team: boolean; member_emails: { email: string; is_primary: boolean }[] };
  };

  const rows = (tickets ?? []) as unknown as TicketRow[];
  const seen = new Set<string>();
  const attendees = rows
    .filter((r) => {
      const m = r.members;
      if (!m || m.kicked_out || !m.has_community_access) return false;
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .map((r) => {
      const m = r.members;
      const primaryEmail = m.member_emails?.find((e) => e.is_primary)?.email ?? m.member_emails?.[0]?.email ?? null;
      return { ...m, primary_email: primaryEmail } as Attendee;
    })
    .sort((a, b) => {
      const aHas = a.current_intro || a.current_ask ? 0 : 1;
      const bHas = b.current_intro || b.current_ask ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return formatName(a.first_name, a.last_name)
        .toLowerCase()
        .localeCompare(formatName(b.first_name, b.last_name).toLowerCase());
    });

  const attendeeHtml = buildAttendeeHtml(attendees);

  // Import sendMorningOfEmail dynamically to avoid circular deps
  const { sendMorningOfEmail } = await import("@/lib/email-send");

  // In testing mode, only send to admin + team members (attendee list in
  // the email body is still the full list for realistic preview)
  const testing = isTestingMode();
  const ADMIN_EMAIL = "eric@marcoullier.com";

  let sent = 0;
  for (const attendee of attendees) {
    if (!attendee.primary_email) continue;
    if (testing) {
      const row = rows.find((r) => r.members.id === (attendee as unknown as { id: string }).id);
      const isAdmin = attendee.primary_email === ADMIN_EMAIL;
      const isTeam = row?.members.is_team === true;
      if (!isAdmin && !isTeam) continue;
    }
    await sendMorningOfEmail(
      attendee.primary_email,
      attendee.first_name,
      dinner.date,
      dinner.venue,
      dinner.address,
      attendeeHtml
    );
    sent++;
  }

  const sentAt = new Date().toISOString();

  // Mark dinner as sent
  await admin
    .from("dinners")
    .update({
      morning_of_sent_at: sentAt,
      morning_of_sent_by: sender.id,
    })
    .eq("id", dinner.id);

  const sentByName = formatName(sender.first_name, sender.last_name);

  await logSystemEvent({
    event_type: "email.bulk_sent",
    actor_id: sender.id,
    summary: `Sent Morning Of email to ${sent} attendees`,
    metadata: {
      kind: "morning_of",
      dinner_id: dinner.id,
      dinner_date: dinner.date,
      recipient_count: sent,
    },
  });

  return { success: true, sent, sentAt, sentByName };
}

export async function saveTemplate(
  slug: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string; updatedAt?: string; updatedByName?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = await createAdminClientForCurrentActor();

  const lookup = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
  }>(admin, user.email!, "id, first_name, last_name");

  if (!lookup) return { success: false, error: "Member not found" };

  const member = lookup.member;

  const { error } = await admin
    .from("email_templates")
    .update({ subject, body, updated_by: member.id })
    .eq("slug", slug);

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    updatedAt: new Date().toISOString(),
    updatedByName: `${member.first_name} ${member.last_name}`,
  };
}
