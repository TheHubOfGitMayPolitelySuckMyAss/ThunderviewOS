/**
 * Resolve the current request's actor (member.id) for use as actor_id
 * on system_events. Server-action helper — uses the session client to
 * read the auth user, then looks up the matching member.
 *
 * Returns null when there is no authenticated user or when the email
 * doesn't match a known member_emails row.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCurrentActorMemberId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;

    const admin = createAdminClient();
    const { data } = await admin
      .from("member_emails")
      .select("member_id")
      .eq("email", user.email.toLowerCase())
      .limit(1)
      .maybeSingle();
    return data?.member_id ?? null;
  } catch (err) {
    console.error("[current-actor] failed to resolve:", err);
    return null;
  }
}
