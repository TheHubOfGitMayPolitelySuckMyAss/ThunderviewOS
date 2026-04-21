"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM, bodyToHtml } from "@/lib/email";
import { formatDateFriendly, formatName, getTodayMT } from "@/lib/format";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

function renderTemplate(
  text: string,
  vars: { firstName: string; dinnerDate: string; venue: string; address: string }
): string {
  return text
    .replace(/\[member\.firstname\]/g, vars.firstName)
    .replace(/\[dinner\.date\]/g, vars.dinnerDate)
    .replace(/\[dinner\.venue\]/g, vars.venue)
    .replace(/\[dinner\.address\]/g, vars.address);
}

type Attendee = {
  first_name: string;
  last_name: string;
  company_name: string | null;
  current_intro: string | null;
  current_ask: string | null;
  ask_updated_at: string | null;
  last_dinner_attended: string | null;
  has_community_access: boolean;
  kicked_out: boolean;
};

function buildAttendeeHtml(attendees: Attendee[]): string {
  if (attendees.length === 0) {
    return "<p><em>No fulfilled attendees for this dinner yet.</em></p>";
  }

  return attendees
    .map((a) => {
      const name = formatName(a.first_name, a.last_name);
      const company = a.company_name ? `<em>${a.company_name}</em>` : "";
      const lines: string[] = [];
      lines.push(`<strong>${name}</strong>${company ? " — " + company : ""}`);
      if (a.current_intro) {
        lines.push(`<br>Intro: ${a.current_intro}`);
      }
      // Show ask if: ask_updated_at > last_dinner_attended, OR never attended before and has an ask
      const showAsk = a.current_ask && (
        !a.last_dinner_attended ||
        (a.ask_updated_at && a.ask_updated_at > a.last_dinner_attended)
      );
      if (showAsk) {
        lines.push(`<br>Ask: ${a.current_ask}`);
      }
      return lines.join("");
    })
    .join("<br><br>---<br><br>");
}

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

  const { data: tickets } = await admin
    .from("tickets")
    .select(
      "member_id, members!inner(id, first_name, last_name, company_name, current_intro, current_ask, ask_updated_at, last_dinner_attended, has_community_access, kicked_out)"
    )
    .eq("dinner_id", dinner.id)
    .eq("fulfillment_status", "fulfilled");

  type TicketRow = {
    member_id: string;
    members: Attendee & { id: string };
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
    .map((r) => r.members)
    .sort((a, b) => {
      const aHasContent = a.current_intro || a.current_ask ? 0 : 1;
      const bHasContent = b.current_intro || b.current_ask ? 0 : 1;
      if (aHasContent !== bHasContent) return aHasContent - bHasContent;
      return formatName(a.first_name, a.last_name)
        .toLowerCase()
        .localeCompare(formatName(b.first_name, b.last_name).toLowerCase());
    });

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

  const admin = createAdminClient();

  const { data: memberEmail } = await admin
    .from("member_emails")
    .select("email, members!inner(id, first_name, last_name)")
    .eq("email", user.email!)
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (!memberEmail) return { success: false, error: "Member not found" };

  const member = memberEmail.members as unknown as {
    id: string;
    first_name: string;
    last_name: string;
  };

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
  const templateHtml = bodyToHtml(renderedBody);
  const attendeeHtml = buildAttendeeHtml(attendees);

  const fullHtml = `${templateHtml}<br><br><hr><br><strong>Tonight's Attendees</strong><br><br>${attendeeHtml}`;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: memberEmail.email,
    subject: renderedSubject,
    html: fullHtml,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function sendPreviewEmail(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: memberEmail } = await admin
    .from("member_emails")
    .select("email, members!inner(id, first_name, last_name)")
    .eq("email", user.email!)
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (!memberEmail) return { success: false, error: "Member not found" };

  const member = memberEmail.members as unknown as {
    id: string;
    first_name: string;
    last_name: string;
  };

  // Load saved template from DB
  const { data: template } = await admin
    .from("email_templates")
    .select("subject, body")
    .eq("slug", "morning-of")
    .single();

  if (!template) return { success: false, error: "Template not found" };

  const result = await getNextDinnerWithAttendees(admin);
  if (!result) return { success: false, error: "No upcoming dinner found" };

  const { dinner, attendees } = result;

  const vars = {
    firstName: member.first_name,
    dinnerDate: formatDateFriendly(dinner.date),
    venue: dinner.venue,
    address: dinner.address,
  };

  const renderedSubject = renderTemplate(template.subject, vars);
  const renderedBody = renderTemplate(template.body, vars);
  const templateHtml = bodyToHtml(renderedBody);
  const attendeeHtml = buildAttendeeHtml(attendees);

  const fullHtml = `${templateHtml}<br><br><hr><br><strong>Tonight's Attendees</strong><br><br>${attendeeHtml}`;

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: memberEmail.email,
    subject: renderedSubject,
    html: fullHtml,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
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

  const admin = createAdminClient();

  const { data: memberEmail } = await admin
    .from("member_emails")
    .select("members!inner(id, first_name, last_name)")
    .eq("email", user.email!)
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (!memberEmail) return { success: false, error: "Member not found" };

  const member = memberEmail.members as unknown as {
    id: string;
    first_name: string;
    last_name: string;
  };

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
