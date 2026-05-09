import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { logSystemEvent } from "@/lib/system-events";

async function memberIdForEmail(email: string | null): Promise<string | null> {
  if (!email) return null;
  try {
    const result = await findMemberByAnyEmail(createAdminClient("public-flow"), email);
    return result?.memberId ?? null;
  } catch (err) {
    console.error("[auth/confirm] memberIdForEmail failed:", err);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // Email param is appended by Supabase email template (manual step:
  // template uses ...&email={{ .Email }}). May be absent on older links.
  const emailParam = searchParams.get("email");

  if (token_hash && type) {
    const cookieStore = await cookies();
    const cookiesToApply: { name: string; value: string; options: Record<string, unknown> }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
            cookiesToApply.push(...cookiesToSet);
          },
        },
      }
    );

    const { data: verifyData, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email",
    });

    if (!error) {
      // Resolve member via the verified email (preferred) or the fallback param
      const verifiedEmail = verifyData?.user?.email ?? emailParam;
      const memberId = await memberIdForEmail(verifiedEmail);
      // The anon_id cookie (set by page-view-logger pre-auth) bridges the
      // anonymous browsing session to the now-identified member. Including it
      // here is what makes the Marketing feed show "Visitor xxxx signed in as
      // Member Y" at the moment of login.
      const anonId = cookieStore.get("anon_id")?.value ?? null;
      await logSystemEvent({
        event_type: "auth.login",
        actor_id: memberId,
        actor_label: memberId ? null : verifiedEmail ?? "unknown",
        subject_member_id: memberId,
        summary: memberId ? null : `Login by unmatched email ${verifiedEmail ?? "(unknown)"}`,
        metadata: { email: verifiedEmail ?? null, anon_id: anonId },
      });

      // Check for a stored redirect target
      const redirectCookie = cookieStore.get("auth_redirect")?.value;
      const redirectPath = redirectCookie ? decodeURIComponent(redirectCookie) : "/portal";
      // Only allow relative paths starting with /
      const safePath = redirectPath.startsWith("/") ? redirectPath : "/portal";

      const response = NextResponse.redirect(`${origin}${safePath}`);
      cookiesToApply.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options as Record<string, string>)
      );
      // Clear the redirect cookie
      response.cookies.set("auth_redirect", "", { path: "/", maxAge: 0 });
      return response;
    }

    // Failure — log only when the email param matches a known member_emails row
    const memberId = await memberIdForEmail(emailParam);
    if (memberId) {
      await logSystemEvent({
        event_type: "auth.login_failed",
        actor_id: memberId,
        subject_member_id: memberId,
        summary: `Login attempt failed: ${error.message}`,
        metadata: { email: emailParam, error: error.message },
      });
    }
  }

  return NextResponse.redirect(
    `${new URL(request.url).origin}/login?error=auth`
  );
}
