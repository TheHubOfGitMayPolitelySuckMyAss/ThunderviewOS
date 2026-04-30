"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let submitterName: string;
  let submitterEmail: string;
  let memberId: string | null = null;
  let role = "anonymous";

  if (user?.email) {
    const { data: memberEmail } = await admin
      .from("member_emails")
      .select("email, member_id, members!inner(id, first_name, last_name, is_team)")
      .eq("email", user.email)
      .eq("is_primary", true)
      .limit(1)
      .single();

    if (memberEmail) {
      const m = memberEmail.members as unknown as {
        id: string;
        first_name: string;
        last_name: string;
        is_team: boolean;
      };

      memberId = m.id;
      submitterName = formatName(m.first_name, m.last_name);
      submitterEmail = memberEmail.email;

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
