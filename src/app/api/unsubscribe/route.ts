import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { safePushMember } from "@/lib/streak/safe-push";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://thunderview-os.vercel.app").trim();

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${SITE_URL}/unsubscribe?status=invalid`);
  }

  const memberId = verifyUnsubscribeToken(token);

  if (!memberId) {
    return NextResponse.redirect(`${SITE_URL}/unsubscribe?status=invalid`);
  }

  const admin = createAdminClient();

  // Set marketing_opted_in = false (the trigger on members handles marketing_opted_out_at)
  const { error } = await admin
    .from("members")
    .update({ marketing_opted_in: false })
    .eq("id", memberId);

  if (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.redirect(`${SITE_URL}/unsubscribe?status=error`);
  }

  await safePushMember(memberId, "member_unsubscribe");

  return NextResponse.redirect(`${SITE_URL}/unsubscribe?status=success`);
}

// Also support POST for List-Unsubscribe-Post one-click
export async function POST(request: NextRequest) {
  return GET(request);
}
