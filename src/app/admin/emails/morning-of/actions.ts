"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM, bodyToHtml, renderTemplateVars } from "@/lib/email";
import { formatDateFriendly, formatName, getTodayMT } from "@/lib/format";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

const renderTemplate = renderTemplateVars;

type Attendee = {
  first_name: string;
  last_name: string;
  company_name: string | null;
  company_website: string | null;
  linkedin_profile: string | null;
  contact_preference: string | null;
  primary_email: string | null;
  current_intro: string | null;
  current_ask: string | null;
  ask_updated_at: string | null;
  last_dinner_attended: string | null;
  has_community_access: boolean;
  kicked_out: boolean;
};

function buildAttendeeHtml(attendees: Attendee[]): string {
  if (attendees.length === 0) {
    return '<p style="font-size:14px;color:#75695B;font-style:italic;">No attendees confirmed yet.</p>';
  }

  return attendees
    .map((a, i) => {
      const name = formatName(a.first_name, a.last_name);
      let nameHtml: string;
      if (a.contact_preference === "linkedin" && a.linkedin_profile) {
        nameHtml = `<a href="${a.linkedin_profile}" style="color:#9A7A5E;text-decoration:none;font-weight:600;font-size:15px;">${name}</a>`;
      } else if (a.primary_email) {
        nameHtml = `<a href="mailto:${a.primary_email}" style="color:#9A7A5E;text-decoration:none;font-weight:600;font-size:15px;">${name}</a>`;
      } else {
        nameHtml = `<span style="font-weight:600;font-size:15px;color:#2B241C;">${name}</span>`;
      }

      let companyHtml = "";
      if (a.company_name) {
        if (a.company_website) {
          const url = a.company_website.startsWith("http") ? a.company_website : `https://${a.company_website}`;
          companyHtml = `<p style="font-size:13px;color:#75695B;margin:0 0 10px;">${a.company_name} &middot; <a href="${url}" style="color:#9A7A5E;">${url.replace(/^https?:\/\//, "")}</a></p>`;
        } else {
          companyHtml = `<p style="font-size:13px;color:#75695B;margin:0 0 10px;">${a.company_name}</p>`;
        }
      }

      const showAsk = a.current_ask && (
        !a.last_dinner_attended ||
        (a.ask_updated_at && a.ask_updated_at > a.last_dinner_attended)
      );

      const sections: string[] = [];
      if (a.current_intro) {
        sections.push(
          `<p style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#9A7A5E;margin:10px 0 3px;">Intro</p>` +
          `<p style="font-size:14px;color:#2B241C;margin:0;line-height:1.55;">${a.current_intro}</p>`
        );
      }
      if (showAsk) {
        sections.push(
          `<p style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#9A7A5E;margin:10px 0 3px;">Ask</p>` +
          `<p style="font-size:14px;color:#2B241C;margin:0;line-height:1.55;">${a.current_ask}</p>`
        );
      }

      const borderTop = i > 0 ? "border-top:1px solid #EDE3D1;" : "";
      const paddingTop = i > 0 ? "padding-top:16px;" : "";

      return `<div style="${borderTop}${paddingTop}padding-bottom:16px;">${nameHtml}${companyHtml ? `<br>${companyHtml}` : ""}${sections.join("")}</div>`;
    })
    .join("");
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
      "member_id, members!inner(id, first_name, last_name, company_name, company_website, linkedin_profile, contact_preference, current_intro, current_ask, ask_updated_at, last_dinner_attended, has_community_access, kicked_out, member_emails(email, is_primary))"
    )
    .eq("dinner_id", dinner.id)
    .eq("fulfillment_status", "fulfilled");

  type TicketRow = {
    member_id: string;
    members: Attendee & { id: string; member_emails: { email: string; is_primary: boolean }[] };
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
  const attendeeHtml = buildAttendeeHtml(attendees);
  const appendedHtml = `<hr style="border:none;border-top:1px solid #E2D7C1;margin:24px 0;"><p style="font-weight:600;margin:0 0 12px;">Tonight\u2019s Attendees</p>${attendeeHtml}`;
  const fullHtml = bodyToHtml(renderedBody, appendedHtml);

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: memberEmail.email,
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

  const admin = createAdminClient();

  // Get sender's member record
  const { data: senderEmail } = await admin
    .from("member_emails")
    .select("members!inner(id, first_name, last_name)")
    .eq("email", user.email!)
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (!senderEmail) return { success: false, error: "Member not found" };

  const sender = senderEmail.members as unknown as {
    id: string;
    first_name: string;
    last_name: string;
  };

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
      "member_id, members!inner(id, first_name, last_name, company_name, company_website, linkedin_profile, contact_preference, current_intro, current_ask, ask_updated_at, last_dinner_attended, has_community_access, kicked_out, member_emails(email, is_primary))"
    )
    .eq("dinner_id", dinner.id)
    .eq("fulfillment_status", "fulfilled");

  type TicketRow = {
    member_id: string;
    members: Attendee & { id: string; member_emails: { email: string; is_primary: boolean }[] };
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

  let sent = 0;
  for (const attendee of attendees) {
    if (!attendee.primary_email) continue;
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
