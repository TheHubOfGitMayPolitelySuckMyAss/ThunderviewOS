import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

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

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
