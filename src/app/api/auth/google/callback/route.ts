/**
 * Google OAuth callback: exchange the authorization code for tokens and store
 * them in the single-row google_oauth_tokens table. Companion to
 * /api/auth/google (see that route for the sharing-with-DigiEric story).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrTeam } from "@/lib/require-admin";
import { logSystemEvent } from "@/lib/system-events";

export async function GET(request: NextRequest) {
  const actor = await requireAdminOrTeam();
  if (!actor) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/emails?gmail=missing_code", request.url)
    );
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${siteUrl}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    await logSystemEvent({
      event_type: "error.caught",
      summary: "Google OAuth token exchange failed",
      metadata: { source: "google_oauth_callback", cause: err.slice(0, 500) },
    });
    return NextResponse.redirect(
      new URL("/admin/emails?gmail=exchange_failed", request.url)
    );
  }

  const tokens = await tokenResponse.json();

  const admin = createAdminClient("system-internal");
  const { error } = await admin.from("google_oauth_tokens").upsert(
    {
      lock: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type ?? "Bearer",
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
      connected_by: actor.memberId,
    },
    { onConflict: "lock" }
  );

  if (error) {
    await logSystemEvent({
      event_type: "error.caught",
      summary: "Failed to store Google OAuth tokens",
      metadata: { source: "google_oauth_callback", cause: error.message },
    });
    return NextResponse.redirect(
      new URL("/admin/emails?gmail=db_error", request.url)
    );
  }

  return NextResponse.redirect(
    new URL("/admin/emails?gmail=connected", request.url)
  );
}
