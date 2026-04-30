import { Resend } from "resend";
import { EMAIL_FROM, bodyToHtml } from "@/lib/email";
import { logSystemEvent } from "@/lib/system-events";

const resend = new Resend(process.env.RESEND_API_KEY!);

type FeedbackEmailOpts = {
  type: "Bug" | "Feedback";
  message: string;
  submitterName: string;
  submitterEmail: string;
  memberId: string | null;
  role: string;
  pageUrl: string;
  referrer: string | null;
  userAgent: string;
  viewport: string;
  timestamp: string;
};

export async function sendFeedbackNotification(opts: FeedbackEmailOpts): Promise<void> {
  try {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://thunderview-os.vercel.app").trim();
    const tag = opts.type === "Bug" ? "[Bug]" : "[Feedback]";
    const subject = `${tag} from ${opts.submitterName}`;

    // Top zone — for Eric (passed as body to bodyToHtml)
    const typeLabel = opts.type === "Bug"
      ? '<span style="display:inline-block;background:#F3E3BE;color:#8a6a1f;font-size:12px;font-weight:600;padding:3px 10px;border-radius:12px;">Bug</span>'
      : '<span style="display:inline-block;background:#E4E9D4;color:#5B6A3B;font-size:12px;font-weight:600;padding:3px 10px;border-radius:12px;">Feedback</span>';

    const memberLink = opts.memberId
      ? ` <a href="${siteUrl}/admin/members/${opts.memberId}" style="color:#9A7A5E;font-size:13px;">(view member)</a>`
      : "";

    // Escape message for HTML but preserve newlines (bodyToHtml converts \n to <br>)
    const escapedMessage = opts.message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const topHtml =
      `<p style="margin:0 0 12px;">${typeLabel}</p>` +
      `<p style="font-size:14px;color:#75695B;margin:0 0 16px;">From: <strong style="color:#2B241C;">${opts.submitterName}</strong> &lt;${opts.submitterEmail}&gt;${memberLink}</p>` +
      escapedMessage;

    // Bottom zone — debug context for Claude Code (passed as appendHtml)
    const debugLines = [
      `member_id:   ${opts.memberId ?? "anonymous"}`,
      `role:        ${opts.role}`,
      `submitted:   ${opts.timestamp}`,
      `url:         ${opts.pageUrl}`,
      `referrer:    ${opts.referrer ?? "none"}`,
      `user_agent:  ${opts.userAgent}`,
      `viewport:    ${opts.viewport}`,
    ].join("\n");

    const debugHtml =
      `<hr style="border:none;border-top:1px solid #E2D7C1;margin:24px 0;">` +
      `<p style="font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#9A7A5E;margin:0 0 8px;">Debug context</p>` +
      `<pre style="font-family:'JetBrains Mono',Menlo,monospace;font-size:12px;color:#75695B;line-height:1.5;margin:0;white-space:pre-wrap;word-break:break-all;">${debugLines}</pre>`;

    const fullHtml = bodyToHtml(topHtml, debugHtml);

    await resend.emails.send({
      from: EMAIL_FROM,
      to: ["eric@marcoullier.com"],
      replyTo: opts.submitterEmail,
      subject,
      html: fullHtml,
    });
    await logSystemEvent({
      event_type: "email.transactional_sent",
      summary: `Sent feedback notification (${opts.type}) from ${opts.submitterName}`,
      metadata: {
        template: "feedback-notification",
        recipient: "eric@marcoullier.com",
        kind: opts.type.toLowerCase(),
      },
    });
  } catch (err) {
    console.error("[email] Failed to send feedback notification:", err);
  }
}
