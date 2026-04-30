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
import { logSystemEvent } from "@/lib/system-events";

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
    await logSystemEvent({
      event_type: "email.transactional_sent",
      subject_member_id: memberId,
      summary: `Sent approval email to ${memberEmail.email}`,
      metadata: { template: "approval", recipient: memberEmail.email, member_id: memberId },
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
    await logSystemEvent({
      event_type: "email.transactional_sent",
      subject_member_id: memberId,
      summary: `Sent re-application email to ${memberEmail.email}`,
      metadata: { template: "re-application", recipient: memberEmail.email, member_id: memberId },
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
    await logSystemEvent({
      event_type: "email.transactional_sent",
      summary: `Sent rejection email to ${app.email}`,
      metadata: {
        template: "rejection",
        recipient: app.email,
        application_id: applicationId,
      },
    });
  } catch (err) {
    console.error("[email] Failed to send rejection email:", err);
  }
}

/**
 * Send fulfillment email (dinner details) to a member.
 *
 * By default, errors are logged and swallowed (existing behavior for Stripe
 * webhook and comp ticket callers). Pass throwOnError: true to let failures
 * propagate — used by the fulfill-tickets cron so it can leave the ticket
 * as 'purchased' and retry on the next run.
 */
export async function sendFulfillmentEmail(
  memberId: string,
  dinnerId: string,
  options?: { throwOnError?: boolean }
): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: memberEmail } = await admin
      .from("member_emails")
      .select("email, members!inner(first_name)")
      .eq("member_id", memberId)
      .eq("is_primary", true)
      .limit(1)
      .single();

    if (!memberEmail) {
      const msg = `No primary email for member ${memberId}`;
      if (options?.throwOnError) throw new Error(msg);
      console.error("[email]", msg);
      return;
    }

    const member = memberEmail.members as unknown as { first_name: string };

    const { data: dinner } = await admin
      .from("dinners")
      .select("date, venue, address")
      .eq("id", dinnerId)
      .single();

    if (!dinner) {
      const msg = `Dinner ${dinnerId} not found`;
      if (options?.throwOnError) throw new Error(msg);
      console.error("[email]", msg);
      return;
    }

    const template = await getTemplate("fulfillment");
    if (!template) {
      const msg = "Fulfillment email template not found";
      if (options?.throwOnError) throw new Error(msg);
      console.error("[email]", msg);
      return;
    }

    const render = (text: string) =>
      text
        .replace(/\[member\.firstname\]/g, member.first_name)
        .replace(/\[dinner\.date\]/g, formatDateFriendly(dinner.date))
        .replace(/\[dinner\.venue\]/g, dinner.venue)
        .replace(/\[dinner\.address\]/g, dinner.address);

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: memberEmail.email,
      subject: render(template.subject),
      html: bodyToHtml(render(template.body)),
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }
    await logSystemEvent({
      event_type: "email.transactional_sent",
      subject_member_id: memberId,
      summary: `Sent fulfillment email to ${memberEmail.email}`,
      metadata: {
        template: "fulfillment",
        recipient: memberEmail.email,
        member_id: memberId,
        dinner_id: dinnerId,
      },
    });
  } catch (err) {
    if (options?.throwOnError) throw err;
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
    const bodyText = [
      `New application from ${application.firstName} ${application.lastName} at ${application.companyName}.`,
      ``,
      application.companyWebsite ? `Website: ${application.companyWebsite}` : null,
      application.linkedinProfile ? `LinkedIn: ${application.linkedinProfile}` : null,
      `Email: ${application.email}`,
      `Type: ${application.attendeeStagetype}`,
    ]
      .filter(Boolean)
      .join("\n");

    const ctaHtml = `<a href="${adminUrl}" style="display:inline-block;background-color:#9A7A5E;color:#FBF7F0 !important;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px;margin:16px 0 6px;">Review Application</a>`;

    // Admin is hard-coded (no is_admin column in DB)
    const recipients = ["eric@marcoullier.com"];

    await resend.emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject,
      html: bodyToHtml(bodyText, ctaHtml),
    });
    await logSystemEvent({
      event_type: "email.transactional_sent",
      summary: `Sent new-application notification for ${application.firstName} ${application.lastName}`,
      metadata: {
        template: "admin-new-application",
        recipient: recipients[0],
        application_id: application.id,
      },
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

    const appendedHtml = `<hr style="border:none;border-top:1px solid #E2D7C1;margin:24px 0;"><p style="font-weight:600;margin:0 0 12px;">Tonight\u2019s Attendees</p>${attendeeHtml}`;
    const fullHtml = bodyToHtml(render(template.body), appendedHtml);

    await resend.emails.send({
      from: EMAIL_FROM,
      to: memberEmail,
      subject: render(template.subject),
      html: fullHtml,
    });
    await logSystemEvent({
      event_type: "email.transactional_sent",
      summary: `Sent morning-of email to ${memberEmail}`,
      metadata: {
        template: "morning-of",
        recipient: memberEmail,
        dinner_date: dinnerDate,
      },
    });
  } catch (err) {
    console.error("[email] Failed to send morning-of email to", memberEmail, err);
  }
}

/**
 * Notify admin of a spam complaint from Resend webhook.
 */
export async function sendComplaintNotification(opts: {
  recipientEmail: string;
  memberName: string | null;
  resendEmailId: string;
  occurredAt: string;
  subject: string | null;
}): Promise<void> {
  try {
    const bodyText = [
      `A spam complaint was received for ${opts.recipientEmail}${opts.memberName ? ` (${opts.memberName})` : ""}.`,
      ``,
      `The member has been automatically opted out of marketing emails.`,
      ``,
      `Resend email ID: ${opts.resendEmailId}`,
      `Subject: ${opts.subject ?? "(unknown)"}`,
      `Occurred: ${opts.occurredAt}`,
    ].join("\n");

    await resend.emails.send({
      from: EMAIL_FROM,
      to: ["eric@marcoullier.com"],
      subject: `Spam complaint: ${opts.recipientEmail}`,
      html: bodyToHtml(bodyText),
    });
    await logSystemEvent({
      event_type: "email.transactional_sent",
      summary: `Sent spam-complaint notification (${opts.recipientEmail})`,
      metadata: {
        template: "admin-complaint-notification",
        recipient: "eric@marcoullier.com",
        about_email: opts.recipientEmail,
        resend_email_id: opts.resendEmailId,
      },
    });
  } catch (err) {
    console.error("[email] Failed to send complaint notification:", err);
  }
}

/**
 * Notify admin of an email send failure from Resend webhook.
 */
export async function sendSendFailureNotification(opts: {
  recipientEmail: string;
  memberName: string | null;
  resendEmailId: string;
  occurredAt: string;
  subject: string | null;
  errorReason: string | null;
}): Promise<void> {
  try {
    const bodyText = [
      `An email send failure was reported for ${opts.recipientEmail}${opts.memberName ? ` (${opts.memberName})` : ""}.`,
      ``,
      `Resend email ID: ${opts.resendEmailId}`,
      `Subject: ${opts.subject ?? "(unknown)"}`,
      `Occurred: ${opts.occurredAt}`,
      opts.errorReason ? `Error: ${opts.errorReason}` : null,
    ].filter(Boolean).join("\n");

    await resend.emails.send({
      from: EMAIL_FROM,
      to: ["eric@marcoullier.com"],
      subject: `Email send failure: ${opts.recipientEmail}`,
      html: bodyToHtml(bodyText),
    });
    await logSystemEvent({
      event_type: "email.transactional_sent",
      summary: `Sent send-failure notification (${opts.recipientEmail})`,
      metadata: {
        template: "admin-send-failure-notification",
        recipient: "eric@marcoullier.com",
        about_email: opts.recipientEmail,
        resend_email_id: opts.resendEmailId,
      },
    });
  } catch (err) {
    console.error("[email] Failed to send failure notification:", err);
  }
}
