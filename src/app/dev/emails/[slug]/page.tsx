/**
 * Dev-only email preview route.
 *
 * Visit /dev/emails/approval, /dev/emails/re-application, etc.
 * Renders the branded HTML shell with sample data — no real sends.
 * Not linked from any page.
 */

import { notFound } from "next/navigation";
import { bodyToHtml, emailCtaButton, emailSignature, emailDetailsTable } from "@/lib/email";

const SAMPLE_DATA: Record<
  string,
  { subject: string; body: string; appendHtml?: string }
> = {
  approval: {
    subject: "You\u2019re in \u2014 welcome to Thunderview",
    body: [
      `<h2 style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-weight:500;font-size:28px;line-height:1.15;letter-spacing:-0.01em;margin:4px 0 14px;color:#2B241C;">You\u2019re in, Priya.</h2>`,
      `<p>Welcome to Thunderview. Your application\u2019s approved, which means you\u2019re officially one of us \u2014 somewhere between 630 and \u201CI\u2019ve lost count\u201D Colorado CEOs who\u2019ve figured out that doing this alone is the dumbest way to do it.</p>`,
      `<p>Here\u2019s what happens next:</p>`,
      `<p><strong>Buy a ticket</strong> to the next dinner whenever you\u2019re ready. Tickets are $40 and cover the meal. Dinners are the first Thursday of the month (we skip January and July \u2014 holidays and summer), at ID345 in Denver.</p>`,
      `<p>${emailCtaButton("Buy Your First Ticket", "https://thunderview-os.vercel.app/portal/tickets")}</p>`,
      `<p>About a week before each dinner, you\u2019ll get an email with the attendee list, intros, and asks \u2014 so you know who to find and what to ask them about.</p>`,
      `<p>That\u2019s it. No onboarding call, no Slack community to ignore, no newsletter. Just dinner, once a month, with people who get it.</p>`,
      emailSignature(),
    ].join("\n"),
  },
  "re-application": {
    subject: "Good to see you again",
    body: [
      `<h2 style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-weight:500;font-size:28px;line-height:1.15;letter-spacing:-0.01em;margin:4px 0 14px;color:#2B241C;">Welcome back, Marcus.</h2>`,
      `<p>Your new application linked to your existing member record, so you keep your history with us. Nothing to do on your end.</p>`,
      `<p>Looks like the last dinner you came to was November 2024 \u2014 been a minute. Lots of new faces since then.</p>`,
      `<p>${emailCtaButton("Grab A Ticket To The Next One", "https://thunderview-os.vercel.app/portal/tickets")}</p>`,
      emailSignature(),
    ].join("\n"),
  },
  rejection: {
    subject: "A quick note on your Thunderview application",
    body: [
      `<h2 style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-weight:500;font-size:28px;line-height:1.15;letter-spacing:-0.01em;margin:4px 0 14px;color:#2B241C;">Thanks for applying.</h2>`,
      `<p>Quick and honest: Thunderview is specifically for CEOs of product and software companies. Your application suggests you\u2019re running a services business \u2014 so it\u2019s not the right fit for what we\u2019re doing at the dinner table.</p>`,
      `<p>This isn\u2019t a judgment on the work \u2014 services businesses are real businesses and we respect them. It\u2019s a scope thing. The dinners only work because the people around the table are solving roughly the same kinds of problems.</p>`,
      `<p>If that ever changes \u2014 you spin up a product company, pivot, etc. \u2014 please re-apply. No hard feelings either way.</p>`,
      emailSignature(),
    ].join("\n"),
  },
  fulfillment: {
    subject: "Thursday\u2019s dinner \u2014 details and attendee list",
    body: [
      // NOTE: Fulfillment hero photo skipped — NEEDS DESIGN REVIEW: per-template hero image support
      `<h2 style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-weight:500;font-size:28px;line-height:1.15;letter-spacing:-0.01em;margin:4px 0 14px;color:#2B241C;">You\u2019re coming to dinner.</h2>`,
      `<p>See you Thursday. A few logistics and the roster below.</p>`,
      emailDetailsTable([
        { label: "Date", value: "Thursday, May 7, 2026" },
        { label: "Doors", value: "6:00 PM" },
        { label: "Dinner", value: "6:45 PM" },
        { label: "Venue", value: "ID345" },
        { label: "Address", value: "3960 High St, Denver, CO 80205" },
        { label: "Parking", value: "Free on the street" },
      ]),
      `<p>The full attendee list, with everyone\u2019s intros and asks, is in the member portal. Give it ten minutes before you show up \u2014 it\u2019s 80% of what makes the night work.</p>`,
      `<p>${emailCtaButton("View The Roster", "https://thunderview-os.vercel.app/portal/recap")}</p>`,
      `<p>Dress is whatever-you-wore-to-work. Bring business cards if you still carry them, don\u2019t stress if you don\u2019t.</p>`,
      emailSignature(),
    ].join("\n"),
  },
  "morning-of": {
    subject: "Tonight \u2014 see you at 6",
    body: [
      `<h2 style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-weight:500;font-size:28px;line-height:1.15;letter-spacing:-0.01em;margin:4px 0 14px;color:#2B241C;">Tonight\u2019s the night.</h2>`,
      `<p>Quick reminders before you head over:</p>`,
      emailDetailsTable([
        { label: "Doors", value: "6:00 PM \u00B7 ID345" },
        { label: "Address", value: "3960 High St, Denver" },
        { label: "At the table", value: "42 people" },
      ]),
      `<p>If you haven\u2019t looked at the roster yet, now\u2019s a great time. Ten minutes with the intros and asks and you\u2019ll walk in knowing exactly who you want to find.</p>`,
      `<p>${emailCtaButton("Open The Roster", "https://thunderview-os.vercel.app/portal/recap")}</p>`,
      `<div style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-style:italic;font-size:18px;color:#4A3F34;line-height:1.4;padding-left:16px;border-left:3px solid #D9C4A0;margin:18px 0;">The whole point of the dinner is that someone in the room has already solved your weird problem. Your job is to find them.</div>`,
      emailSignature(),
    ].join("\n"),
  },
  "admin-notification": {
    subject: "New Application: Priya Desai (Caravan Labs)",
    body: [
      `<p>New application from <strong>Priya Desai</strong> at <strong>Caravan Labs</strong>.</p>`,
      `<p>Website: caravanlabs.com<br>LinkedIn: linkedin.com/in/priyadesai<br>Email: priya@caravanlabs.com<br>Type: Active CEO (Bootstrapping or VC-Backed)</p>`,
    ].join("\n"),
    appendHtml: emailCtaButton("Review Application", "https://thunderview-os.vercel.app/admin/applications/123"),
  },
};

export default async function EmailPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sample = SAMPLE_DATA[slug];

  if (!sample) {
    notFound();
  }

  const html = bodyToHtml(sample.body, sample.appendHtml);

  return (
    <div>
      <div style={{ background: "#2B241C", color: "#FBF7F0", padding: "12px 24px", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        <strong>Email Preview:</strong> {slug} &middot; Subject: {sample.subject}
        <span style={{ float: "right", opacity: 0.5 }}>
          {Object.keys(SAMPLE_DATA).map((s) => (
            <a key={s} href={`/dev/emails/${s}`} style={{ color: "#D9C4A0", marginLeft: 12, textDecoration: s === slug ? "underline" : "none" }}>
              {s}
            </a>
          ))}
        </span>
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
