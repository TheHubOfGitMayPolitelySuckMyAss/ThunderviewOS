"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { logSystemEvent } from "@/lib/system-events";
import { formatName } from "@/lib/format";

const ANON_COOKIE = "anon_id";
const ANON_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

type LogPageViewInput = {
  path: string;
  search_params?: Record<string, string>;
  user_agent?: string | null;
};

function extractClientIp(headerStore: Headers): string | null {
  // Vercel populates x-forwarded-for with the originating client IP first,
  // then any intermediate proxies. Take the first non-empty entry.
  const xff = headerStore.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerStore.get("x-real-ip") || null;
}

/**
 * Log a page view to system_events as event_type='page.viewed'.
 *
 * - Authenticated visit: actor_id = members.id, actor_label = full name.
 *   anon_id is NOT included in metadata even if the cookie persists from a
 *   pre-auth session.
 * - Anonymous visit: actor_id = null, actor_label = 'anonymous',
 *   metadata.anon_id = an opaque UUID. Cookie is created on the first view
 *   and reused across subsequent anonymous visits.
 *
 * Best-effort: failures are logged via console only. logSystemEvent itself
 * never throws into callers.
 */
export async function logPageView(input: LogPageViewInput): Promise<void> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const ip = extractClientIp(headerStore);
  let actorId: string | null = null;
  let actorLabel: string | null = "anonymous";
  let anonId: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      const result = await findMemberByAnyEmail<{
        first_name: string;
        last_name: string;
      }>(createAdminClient("system-internal"), user.email, "first_name, last_name");
      if (result) {
        actorId = result.memberId;
        actorLabel = formatName(result.member.first_name, result.member.last_name);
      }
    }
  } catch (err) {
    // Auth lookup failure → treat as anonymous, don't break navigation
    console.error("[page-view] auth lookup failed:", err);
  }

  if (!actorId) {
    anonId = cookieStore.get(ANON_COOKIE)?.value ?? null;
    if (!anonId) {
      anonId = crypto.randomUUID();
      cookieStore.set(ANON_COOKIE, anonId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ANON_TTL_SECONDS,
        path: "/",
      });
    }
  }

  const metadata: Record<string, unknown> = { path: input.path };
  if (input.search_params && Object.keys(input.search_params).length > 0) {
    metadata.search_params = input.search_params;
  }
  if (!actorId && anonId) {
    metadata.anon_id = anonId;
  }
  if (input.user_agent) {
    metadata.user_agent = input.user_agent;
  }
  if (ip) {
    metadata.ip = ip;
  }

  await logSystemEvent({
    event_type: "page.viewed",
    actor_id: actorId,
    actor_label: actorLabel,
    summary: input.path,
    metadata,
  });
}
