/**
 * Transactional email sending utilities.
 * Each function loads the template from email_templates, renders variables,
 * and sends via Resend. Failures are logged but do not throw — email
 * delivery should not block the triggering action.
 */

import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM, bodyToHtml } from "@/lib/email";
import { formatDateFriendly, formatName, getTodayMT } from "@/lib/format";

const resend = new Resend(process.env.RESEND_API_KEY!);

async function getTemplate(slug: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("email_templates")
    .select("subject, body")
    .eq("slug", slug)
    .single();
  return data;
}

/**
 * Send approval email to a newly approved member.
 */
export async function sendApprovalEmail(memberId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: memberEmail } = await admin
      .from("member_emails")
      .select("email, members!inner(first_name)")
      .eq("member_id", memberId)
      .eq("is_primary", true)
      .limit(1)
      .single();

    if (!memberEmail) return;

    const member = memberEmail.members as unknown as { first_name: string };
    const template = await getTemplate("approval");
    if (!template) return;

    const subject = template.subject.replace(/\[member\.firstname\]/g, member.first_name);
    const body = template.body.replace(/\[member\.firstname\]/g, member.first_name);

    await resend.emails.send({
      from: EMAIL_FROM,
      to: memberEmail.email,
      subject,
      html: bodyToHtml(body),
    });
  } catch (err) {
    console.error("[email] Failed to send approval email:", err);
  }
}

/**
 * Send re-application email to an existing member who applied again.
 */
export async function sendReApplicationEmail(memberId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: memberEmail } = await admin
      .from("member_emails")
      .select("email, members!inner(first_name)")
      .eq("member_id", memberId)
      .eq("is_primary", true)
      .limit(1)
      .single();

    if (!memberEmail) return;

    const member = memberEmail.members as unknown as { first_name: string };
    const template = await getTemplate("re-application");
    if (!template) return;

    const subject = template.subject.replace(/\[member\.firstname\]/g, member.first_name);
    const body = template.body.replace(/\[member\.firstname\]/g, member.first_name);

    await resend.emails.send({
      from: EMAIL_FROM,
      to: memberEmail.email,
      subject,
      html: bodyToHtml(body),
    });
  } catch (err) {
    console.error("[email] Failed to send re-application email:", err);
  }
}

/**
 * Send rejection email to an applicant.
 */
export async function sendRejectionEmail(applicationId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: app } = await admin
      .from("applications")
      .select("first_name, email")
      .eq("id", applicationId)
      .single();

    if (!app) return;

    const template = await getTemplate("rejection");
    if (!template) return;

    const subject = template.subject.replace(/\[applicant\.firstname\]/g, app.first_name);
    const body = template.body.replace(/\[applicant\.firstname\]/g, app.first_name);

    await resend.emails.send({
      from: EMAIL_FROM,
      to: app.email,
      subject,
      html: bodyToHtml(body),
    });
  } catch (err) {
    console.error("[email] Failed to send rejection email:", err);
  }
}

/**
 * Send fulfillment email (dinner details) to a member.
 */
export async function sendFulfillmentEmail(memberId: string, dinnerId: string): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: memberEmail } = await admin
      .from("member_emails")
      .select("email, members!inner(first_name)")
      .eq("member_id", memberId)
      .eq("is_primary", true)
      .limit(1)
      .single();

    if (!memberEmail) return;

    const member = memberEmail.members as unknown as { first_name: string };

    const { data: dinner } = await admin
      .from("dinners")
      .select("date, venue, address")
      .eq("id", dinnerId)
      .single();

    if (!dinner) return;

    const template = await getTemplate("fulfillment");
    if (!template) return;

    const render = (text: string) =>
      text
        .replace(/\[member\.firstname\]/g, member.first_name)
        .replace(/\[dinner\.date\]/g, formatDateFriendly(dinner.date))
        .replace(/\[dinner\.venue\]/g, dinner.venue)
        .replace(/\[dinner\.address\]/g, dinner.address);

    await resend.emails.send({
      from: EMAIL_FROM,
      to: memberEmail.email,
      subject: render(template.subject),
      html: bodyToHtml(render(template.body)),
    });
  } catch (err) {
    console.error("[email] Failed to send fulfillment email:", err);
  }
}

/**
 * Send notification to admin(s) when a new application is submitted.
 */
export async function sendNewApplicationNotification(application: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  companyWebsite: string;
  linkedinProfile: string;
  attendeeStagetype: string;
}): Promise<void> {
  try {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://thunderview-os.vercel.app").trim();
    const adminUrl = `${siteUrl}/admin/applications/${application.id}`;

    const subject = `New Application: ${application.firstName} ${application.lastName} (${application.companyName})`;
    const body = [
      `<a href="${adminUrl}">Review Application →</a>`,
      ``,
      `<strong>${application.firstName} ${application.lastName}</strong>`,
      `${application.companyName}`,
      application.companyWebsite ? `Website: ${application.companyWebsite}` : null,
      application.linkedinProfile ? `LinkedIn: ${application.linkedinProfile}` : null,
      `Email: ${application.email}`,
      `Type: ${application.attendeeStagetype}`,
    ]
      .filter(Boolean)
      .join("<br>");

    // Admin is hard-coded (no is_admin column in DB)
    const recipients = ["eric@marcoullier.com"];

    await resend.emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject,
      html: body,
    });
  } catch (err) {
    console.error("[email] Failed to send new application notification:", err);
  }
}

/**
 * Send morning-of email to a member (template + attendee section).
 */
export async function sendMorningOfEmail(
  memberEmail: string,
  firstName: string,
  dinnerDate: string,
  venue: string,
  address: string,
  attendeeHtml: string
): Promise<void> {
  try {
    const template = await getTemplate("morning-of");
    if (!template) return;

    const render = (text: string) =>
      text
        .replace(/\[member\.firstname\]/g, firstName)
        .replace(/\[dinner\.date\]/g, formatDateFriendly(dinnerDate))
        .replace(/\[dinner\.venue\]/g, venue)
        .replace(/\[dinner\.address\]/g, address);

    const templateHtml = bodyToHtml(render(template.body));
    const fullHtml = `${templateHtml}<br><br><hr><br><strong>Tonight's Attendees</strong><br><br>${attendeeHtml}`;

    await resend.emails.send({
      from: EMAIL_FROM,
      to: memberEmail,
      subject: render(template.subject),
      html: fullHtml,
    });
  } catch (err) {
    console.error("[email] Failed to send morning-of email to", memberEmail, err);
  }
}
