import { createAdminClient } from "@/lib/supabase/admin";

/**
 * EMAIL_MODE controls marketing email recipient scope.
 * - "testing": only admin (eric@marcoullier.com) + team members (is_team = true)
 * - "live": all members with marketing_opted_in = true
 *
 * Set via NEXT_PUBLIC_EMAIL_MODE env var. Defaults to "testing" for safety.
 */
export function getEmailMode(): "testing" | "live" {
  const mode = process.env.NEXT_PUBLIC_EMAIL_MODE?.trim().toLowerCase();
  return mode === "live" ? "live" : "testing";
}

export function isTestingMode(): boolean {
  return getEmailMode() === "testing";
}

type RecipientRow = {
  id: string;
  first_name: string;
  member_emails: { email: string }[];
};

/**
 * Fetches marketing email recipients based on EMAIL_MODE.
 * - testing: admin + team members only
 * - live: all marketing-opted-in, non-kicked-out members
 */
export async function getMarketingRecipients(): Promise<RecipientRow[]> {
  const admin = createAdminClient();
  const mode = getEmailMode();

  if (mode === "testing") {
    // Get admin + team members with primary active emails
    const { data } = await admin
      .from("members")
      .select("id, first_name, is_team, member_emails!inner(email)")
      .eq("kicked_out", false)
      .eq("member_emails.is_primary", true)
      .eq("member_emails.email_status", "active")
      .or("is_team.eq.true");

    // Also include admin by email
    const { data: adminData } = await admin
      .from("member_emails")
      .select("members!inner(id, first_name, is_team, kicked_out), email")
      .eq("email", "eric@marcoullier.com")
      .eq("is_primary", true)
      .limit(1)
      .single();

    const rows = (data ?? []) as unknown as RecipientRow[];
    const seen = new Set(rows.map((r) => r.id));

    // Add admin if not already in team list
    if (adminData) {
      const m = adminData.members as unknown as { id: string; first_name: string; kicked_out: boolean };
      if (!m.kicked_out && !seen.has(m.id)) {
        rows.push({ id: m.id, first_name: m.first_name, member_emails: [{ email: adminData.email }] });
      }
    }

    return rows;
  }

  // Live mode: all marketing-opted-in, paginated
  const allRecipients: RecipientRow[] = [];
  let from = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data } = await admin
      .from("members")
      .select("id, first_name, member_emails!inner(email)")
      .eq("marketing_opted_in", true)
      .eq("kicked_out", false)
      .eq("member_emails.is_primary", true)
      .eq("member_emails.email_status", "active")
      .range(from, from + PAGE_SIZE - 1);

    const rows = (data ?? []) as unknown as RecipientRow[];
    allRecipients.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRecipients;
}

/**
 * Returns the count of marketing email recipients for the current mode.
 */
export async function getMarketingRecipientCount(): Promise<number> {
  const recipients = await getMarketingRecipients();
  return recipients.length;
}
