/**
 * Resolve the From display name for the CONNECTED Gmail account.
 *
 * Any admin/team member can connect their own Gmail (/api/auth/google — one
 * google_oauth_tokens grant), and merges then send from that person's
 * address. So the name must come from whoever owns the account:
 *   1. Gmail send-as displayName, if non-empty;
 *   2. else the member who owns the send-as address (findMemberByAnyEmail —
 *      any of their emails, not just primary): first_name + last_name;
 *   3. else no name → bare address, plus a system_events warning
 *      (`email.sender_name_missing`) when `warn` is set.
 * Never a hardcoded name. Ladder logic: resolveSenderNameWith (send.ts).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { logSystemEvent } from "@/lib/system-events";
import { resolveSenderNameWith, type SendAsIdentity } from "@/lib/gmail/send";

type OwnerName = { first_name: string | null; last_name: string | null };

export async function resolveSenderFromName(
  sendAs: SendAsIdentity,
  opts: { warn: boolean; context: string }
): Promise<string | null> {
  return resolveSenderNameWith(
    sendAs,
    async (email) => {
      const owner = await findMemberByAnyEmail<OwnerName>(
        createAdminClient("read-only"),
        email,
        "id, first_name, last_name"
      );
      return owner?.member ?? null;
    },
    async () => {
      if (!opts.warn) return;
      await logSystemEvent({
        event_type: "email.sender_name_missing",
        summary: `Sending as bare ${sendAs.email}: Gmail send-as name is empty and no member owns that address`,
        metadata: {
          source: "gmail_sender_name",
          context: opts.context,
          send_as_email: sendAs.email,
        },
      });
    }
  );
}
