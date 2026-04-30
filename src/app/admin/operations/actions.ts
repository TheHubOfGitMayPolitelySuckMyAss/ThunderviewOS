"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatName } from "@/lib/format";

export async function searchMembersForActor(
  query: string
): Promise<{ id: string; name: string }[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const admin = createAdminClient();
  const words = trimmed.split(/\s+/).filter(Boolean);

  let q = admin
    .from("members")
    .select("id, first_name, last_name")
    .order("first_name")
    .limit(10);

  // Match any word against either name. PostgREST OR syntax.
  for (const word of words) {
    q = q.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%`);
  }

  const { data } = await q;
  return (data ?? []).map((m) => ({
    id: m.id,
    name: formatName(m.first_name, m.last_name),
  }));
}
