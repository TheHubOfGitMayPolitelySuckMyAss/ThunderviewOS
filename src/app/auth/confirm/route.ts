import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (token_hash && type) {
    const cookieStore = await cookies();

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

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email",
    });

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email;

      if (email === "eric@marcoullier.com") {
        return NextResponse.redirect(`${origin}/admin`);
      }

      const { data: member } = await supabase
        .from("members")
        .select("is_team, kicked_out")
        .eq("email", email!)
        .single();

      const isTeam = member?.is_team === true && member?.kicked_out === false;
      return NextResponse.redirect(
        `${origin}${isTeam ? "/admin" : "/portal"}`
      );
    }
  }

  return NextResponse.redirect(
    `${new URL(request.url).origin}/login?error=auth`
  );
}
