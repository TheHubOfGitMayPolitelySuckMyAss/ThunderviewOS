"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { formatName } from "@/lib/format";
import { sendFeedbackNotification } from "@/lib/email-feedback";
import { logSystemEvent } from "@/lib/system-events";

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
  const admin = createAdminClient("system-internal");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let submitterName: string;
  let submitterEmail: string;
  let memberId: string | null = null;
  let role = "anonymous";

  if (user?.email) {
    const lookup = await findMemberByAnyEmail<{
      id: string;
      first_name: string;
      last_name: string;
      is_team: boolean;
    }>(admin, user.email, "id, first_name, last_name, is_team");

    if (lookup) {
      const m = lookup.member;
      memberId = m.id;
      submitterName = formatName(m.first_name, m.last_name);
      submitterEmail = lookup.matchedEmail;

      const isAdmin = user.email === "eric@marcoullier.com";
      role = isAdmin ? "admin" : m.is_team ? "team" : "member";
    } else {
      submitterName = user.email;
      submitterEmail = user.email;
    }
  } else {
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
    pageUrl: input.url,
    referrer: input.referrer,
    userAgent: input.userAgent,
    viewport: input.viewport,
    timestamp: input.timestamp,
  });

  await logSystemEvent({
    event_type: "feedback.submitted",
    actor_id: memberId,
    actor_label: memberId ? null : submitterName,
    summary: `${input.type} from ${submitterName}`,
    metadata: {
      kind: input.type.toLowerCase(),
      role,
      url: input.url,
    },
  });

  return { success: true };
}
