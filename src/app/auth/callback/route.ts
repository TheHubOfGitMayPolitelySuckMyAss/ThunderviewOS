import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMemberByAnyEmail } from "@/lib/member-lookup";
import { logSystemEvent } from "@/lib/system-events";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
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

    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const verifiedEmail = exchangeData?.user?.email ?? null;
      let memberId: string | null = null;
      if (verifiedEmail) {
        try {
          const result = await findMemberByAnyEmail(createAdminClient(), verifiedEmail);
          memberId = result?.memberId ?? null;
        } catch (err) {
          console.error("[auth/callback] member lookup failed:", err);
        }
      }
      await logSystemEvent({
        event_type: "auth.login",
        actor_id: memberId,
        actor_label: memberId ? null : verifiedEmail ?? "unknown",
        subject_member_id: memberId,
        summary: memberId ? null : `Login by unmatched email ${verifiedEmail ?? "(unknown)"}`,
        metadata: { email: verifiedEmail, flow: "code_exchange" },
      });

      const redirectCookie = cookieStore.get("auth_redirect")?.value;
      const redirectPath = redirectCookie ? decodeURIComponent(redirectCookie) : "/portal";
      const safePath = redirectPath.startsWith("/") ? redirectPath : "/portal";

      const response = NextResponse.redirect(new URL(safePath, origin));
      cookiesToApply.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options as Record<string, string>)
      );
      response.cookies.set("auth_redirect", "", { path: "/", maxAge: 0 });
      return response;
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", new URL(request.url).origin));
}
