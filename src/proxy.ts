import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { findMemberByAnyEmail } from "@/lib/member-lookup";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Simple redirects
  if (request.nextUrl.pathname === "/tickets") {
    const url = request.nextUrl.clone();
    url.pathname = "/portal/tickets";
    return NextResponse.redirect(url);
  }

  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      const redirectPath = request.nextUrl.pathname + request.nextUrl.search;
      url.pathname = "/login";
      url.search = `?redirect=${encodeURIComponent(redirectPath)}`;
      return NextResponse.redirect(url);
    }

    const email = user.email;
    const isAdmin = email === "eric@marcoullier.com";

    if (!isAdmin) {
      const adminClient = createAdminSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      let isTeam = false;
      try {
        const result = await findMemberByAnyEmail<{ is_team: boolean; kicked_out: boolean }>(
          adminClient,
          email!,
          "is_team, kicked_out"
        );
        isTeam = result?.member.is_team === true && result.member.kicked_out === false;
      } catch (err) {
        // Fail closed — treat as not-team — but surface the error loudly.
        console.error("[proxy] team check lookup failed, denying admin access:", err);
      }

      if (!isTeam) {
        const url = request.nextUrl.clone();
        url.pathname = "/portal";
        return NextResponse.redirect(url);
      }
    }
  }

  // Protect /portal routes — require auth + has_community_access (admin bypasses)
  if (request.nextUrl.pathname.startsWith("/portal")) {
    if (!user) {
      const url = request.nextUrl.clone();
      const redirectPath = request.nextUrl.pathname + request.nextUrl.search;
      url.pathname = "/login";
      url.search = `?redirect=${encodeURIComponent(redirectPath)}`;
      return NextResponse.redirect(url);
    }

    const email = user.email;
    const isAdmin = email === "eric@marcoullier.com";

    if (!isAdmin) {
      const adminClient = createAdminSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      let hasAccess = false;
      try {
        const result = await findMemberByAnyEmail<{ has_community_access: boolean }>(
          adminClient,
          email!,
          "has_community_access"
        );
        hasAccess = result?.member.has_community_access === true;
      } catch (err) {
        // Fail closed — deny portal access — but surface the error loudly.
        console.error("[proxy] portal access lookup failed, denying:", err);
      }

      if (!hasAccess) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }
  }

  // Redirect authenticated users away from login
  if (request.nextUrl.pathname === "/login" && user) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const url = request.nextUrl.clone();
    url.pathname = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/portal";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
