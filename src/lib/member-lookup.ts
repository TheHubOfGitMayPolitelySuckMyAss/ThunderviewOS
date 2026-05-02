import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient;

export type MemberLookupResult<T> = {
  /** The matched email row's address (may be a secondary, not the primary). */
  matchedEmail: string;
  memberId: string;
  /** Projected fields from members per the caller's `membersProjection`. */
  member: T;
};

/**
 * Find a member by ONE of their email addresses (primary OR secondary).
 *
 * This is the canonical "auth lookup" — the multi-email contract guarantees
 * a member can be found via ANY of their registered emails, not only their
 * current primary. Use this everywhere the user's identity is the inbound
 * email (auth confirm/callback, layouts, portal pages, current-actor).
 *
 * Returns `null` when no member is registered under the email.
 * THROWS on DB errors — never silently returns null on failure.
 *
 * `membersProjection` is the PostgREST select string for the embedded
 * `members!inner(...)` projection. Default `"id"` is enough to identify the
 * member; pass extras when you need them.
 */
export async function findMemberByAnyEmail<T = Record<string, never>>(
  admin: AdminClient,
  email: string,
  membersProjection: string = "id"
): Promise<MemberLookupResult<T> | null> {
  // The select string is built from a runtime parameter, so PostgREST's
  // template-literal type parser can't infer the row shape — cast to a loose
  // shape and let the caller's generic narrow the projected fields.
  const { data, error } = await admin
    .from("member_emails")
    .select(`email, member_id, members!inner(${membersProjection})`)
    .eq("email", email.toLowerCase())
    .limit(1)
    .maybeSingle<{ email: string; member_id: string; members: T }>();

  if (error) {
    throw new Error(
      `findMemberByAnyEmail(${email}) query failed: ${error.message}`
    );
  }
  if (!data) return null;

  return {
    matchedEmail: data.email,
    memberId: data.member_id,
    member: data.members,
  };
}

/**
 * Return the current primary email address for a member.
 *
 * THROWS when the member has no primary email — that violates the
 * `trg_member_has_primary_email` invariant and should never occur in
 * production. Loud failure here is intentional: a silent fallback would
 * mask schema corruption.
 */
export async function getMemberPrimaryEmail(
  admin: AdminClient,
  memberId: string
): Promise<string> {
  const { data, error } = await admin
    .from("member_emails")
    .select("email")
    .eq("member_id", memberId)
    .eq("is_primary", true)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(
      `getMemberPrimaryEmail(${memberId}) failed: ${error?.message ?? "no primary email row"}`
    );
  }
  return data.email as string;
}
