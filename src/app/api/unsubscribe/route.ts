/**
 * Marketing opt-out endpoint. Token = HMAC-signed member id
 * (src/lib/unsubscribe.ts); no session, no cookies.
 *
 *   GET  — the link in Resend marketing footers. Opts out, then redirects to
 *          the /unsubscribe confirmation page.
 *   POST — RFC 8058 one-click, fired by the mail client from the
 *          List-Unsubscribe + List-Unsubscribe-Post headers (Resend marketing
 *          emails and Gmail mail merges). Opts out and answers with a plain
 *          status — the client isn't a browser, so no redirect.
 *
 * Both flip members.marketing_opted_in = false (the members trigger stamps
 * marketing_opted_out_at). Idempotent. Admin client reason "public-flow":
 * the actor is an anonymous recipient, so the audit row has no actor.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://thunderviewceodinners.com").trim();

type OptOutResult = "success" | "invalid" | "error";

async function optOut(token: string | null): Promise<OptOutResult> {
  if (!token) return "invalid";
  const memberId = verifyUnsubscribeToken(token);
  if (!memberId) return "invalid";

  const admin = createAdminClient("public-flow");
  // Set marketing_opted_in = false (the trigger on members handles marketing_opted_out_at)
  const { error } = await admin
    .from("members")
    .update({ marketing_opted_in: false })
    .eq("id", memberId);

  if (error) {
    console.error("Unsubscribe error:", error);
    return "error";
  }
  return "success";
}

export async function GET(request: NextRequest) {
  const status = await optOut(request.nextUrl.searchParams.get("token"));
  return NextResponse.redirect(`${SITE_URL}/unsubscribe?status=${status}`);
}

export async function POST(request: NextRequest) {
  const status = await optOut(request.nextUrl.searchParams.get("token"));
  const code = status === "success" ? 200 : status === "invalid" ? 400 : 500;
  return new NextResponse(
    status === "success" ? "Unsubscribed" : `Unsubscribe ${status}`,
    { status: code, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
