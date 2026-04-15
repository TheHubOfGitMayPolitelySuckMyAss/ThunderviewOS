import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Check admin/team status
    const email = user.email;
    const isAdmin = email === "eric@marcoullier.com";

    if (!isAdmin) {
      const { data: member } = await supabase
        .from("members")
        .select("is_team, kicked_out")
        .eq("email", email!)
        .single();

      const isTeam = member?.is_team === true && member?.kicked_out === false;

      if (!isTeam) {
        const url = request.nextUrl.clone();
        url.pathname = "/portal";
        return NextResponse.redirect(url);
      }
    }
  }

  // Redirect authenticated users away from login
  if (request.nextUrl.pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    const email = user.email;
    const isAdmin = email === "eric@marcoullier.com";

    if (isAdmin) {
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    const { data: member } = await supabase
      .from("members")
      .select("is_team, kicked_out")
      .eq("email", email!)
      .single();

    const isTeam = member?.is_team === true && member?.kicked_out === false;
    url.pathname = isTeam ? "/admin" : "/portal";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
