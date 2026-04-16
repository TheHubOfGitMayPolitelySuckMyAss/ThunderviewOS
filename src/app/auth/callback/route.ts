import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const redirectUrl = new URL("/admin", origin);

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
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email;

      if (email === "eric@marcoullier.com") {
        return NextResponse.redirect(redirectUrl);
      }

      const { data: memberRow } = await supabase
        .from("member_emails")
        .select("members!inner(is_team, kicked_out)")
        .eq("email", email!)
        .limit(1)
        .single();

      const member = (memberRow?.members as unknown as { is_team: boolean; kicked_out: boolean }) ?? null;
      const isTeam = member?.is_team === true && member?.kicked_out === false;
      redirectUrl.pathname = isTeam ? "/admin" : "/portal";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", new URL(request.url).origin));
}
