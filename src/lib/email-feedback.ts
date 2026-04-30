import { Resend } from "resend";
import { EMAIL_FROM, bodyToHtml } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY!);

type FeedbackEmailOpts = {
  type: "Bug" | "Feedback";
  message: string;
  submitterName: string;
  submitterEmail: string;
  memberId: string | null;
  role: string;
  memberContext: Record<string, unknown> | null;
  recentTickets: Record<string, unknown>[];
  lastApplication: Record<string, unknown> | null;
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

    const lines: string[] = [];

    // Message (prominent)
    lines.push(opts.message);
    lines.push("");

    // Submitted by
    lines.push("--- Submitted by ---");
    lines.push(`Name: ${opts.submitterName}`);
    lines.push(`Email: ${opts.submitterEmail}`);
    if (opts.memberId) {
      lines.push(`Member: ${siteUrl}/admin/members/${opts.memberId}`);
    }
    lines.push(`Role: ${opts.role}`);
    lines.push("");

    // Page context
    lines.push("--- Page context ---");
    lines.push(`URL: ${opts.pageUrl}`);
    if (opts.referrer) lines.push(`Referrer: ${opts.referrer}`);
    lines.push(`User agent: ${opts.userAgent}`);
    lines.push(`Viewport: ${opts.viewport}`);
    lines.push(`Timestamp: ${opts.timestamp}`);

    // Member context (only if matched)
    if (opts.memberContext) {
      const mc = opts.memberContext;
      lines.push("");
      lines.push("--- Member context ---");
      const stagetypes = mc.stagetypes as string[] | undefined;
      lines.push(`Types: ${stagetypes?.length ? stagetypes.join(", ") : "(none)"}`);
      lines.push(`Community access: ${mc.has_community_access}`);
      lines.push(`Kicked out: ${mc.kicked_out}`);
      lines.push(`Marketing opted in: ${mc.marketing_opted_in}`);
      lines.push(`Primary email status: ${mc.primary_email_status}`);
      lines.push(`Intro updated: ${mc.intro_updated_at ?? "never"}`);
      lines.push(`Ask updated: ${mc.ask_updated_at ?? "never"}`);

      if (opts.recentTickets.length > 0) {
        lines.push("");
        lines.push("Last 3 tickets:");
        for (const t of opts.recentTickets) {
          lines.push(`  ${t.dinner_date} — ${t.status} (${t.payment_source}, $${t.amount_paid})`);
        }
      }

      if (opts.lastApplication) {
        const la = opts.lastApplication;
        lines.push("");
        lines.push(`Last application: ${la.status} (${la.submitted_on})`);
      }
    }

    await resend.emails.send({
      from: EMAIL_FROM,
      to: ["eric@marcoullier.com"],
      replyTo: opts.submitterEmail,
      subject,
      html: bodyToHtml(lines.join("\n")),
    });
  } catch (err) {
    console.error("[email] Failed to send feedback notification:", err);
  }
}
