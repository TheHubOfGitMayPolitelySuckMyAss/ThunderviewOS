/**
 * Session-based admin/team check for route handlers and server actions.
 *
 * The proxy only protects /admin PAGE paths — API routes and server actions
 * must gate themselves. This helper resolves the session user to a member via
 * findMemberByAnyEmail (multi-email safe) and requires hardcoded-admin OR
 * is_team, matching is_admin_or_team() in Postgres.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMemberByAnyEmail } from "@/lib/member-lookup";

export type AdminOrTeamActor = {
  memberId: string;
  email: string;
  firstName: string;
  lastName: string;
};

export async function requireAdminOrTeam(): Promise<AdminOrTeamActor | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const admin = createAdminClient("read-only");
  const lookup = await findMemberByAnyEmail<{
    id: string;
    first_name: string;
    last_name: string;
    is_team: boolean;
    kicked_out: boolean;
  }>(admin, user.email, "id, first_name, last_name, is_team, kicked_out");

  if (!lookup) return null;

  const isAdmin = user.email === "eric@marcoullier.com";
  const isTeam = lookup.member.is_team && !lookup.member.kicked_out;
  if (!isAdmin && !isTeam) return null;

  return {
    memberId: lookup.member.id,
    email: lookup.matchedEmail,
    firstName: lookup.member.first_name,
    lastName: lookup.member.last_name,
  };
}
