"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { EMAIL_FROM, bodyToHtml, renderTemplateVars } from "@/lib/email";
import { formatDateFriendly, formatName, getTodayMT } from "@/lib/format";
import { getDinnerAttendees, buildAttendeeHtml } from "@/lib/email-intros-asks";
import { sendMorningOfToDinner } from "@/lib/morning-of-send";
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
  const appendedHtml = `<hr style="border:none;border-top:1px solid #E2D7C1;margin:24px 0;"><p style="font-weight:600;margin:0 0 12px;">Tonight’s Attendees</p>${attendeeHtml}`;
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

  const senderLookup = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
  }>(admin, user.email!, "id, first_name, last_name");

  if (!senderLookup) return { success: false, error: "Member not found" };

  const sender = senderLookup.member;

  try {
    const { sent, sentAt } = await sendMorningOfToDinner(admin, dinnerId, sender.id);
    return {
      success: true,
      sent,
      sentAt,
      sentByName: formatName(sender.first_name, sender.last_name),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
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
