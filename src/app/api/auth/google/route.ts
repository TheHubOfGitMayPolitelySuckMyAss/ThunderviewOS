/**
 * Kick off the Google OAuth consent flow for connecting Eric's Gmail
 * (mail-merge sending). Reuses the DigiEric Google Cloud OAuth client
 * (GOOGLE_CLIENT_ID/SECRET) — this app's callback URL must be listed on that
 * client in Google Cloud console.
 *
 * Scopes are narrower than DigiEric's: send + settings.basic (signature read)
 * + modify (read inbox messages and move labels, for the TV Bounce / TV Skip
 * label-actions cron). No calendar/contacts.
 *
 * Admin/team gated: the proxy only protects /admin page paths, so this route
 * checks the session itself.
 */

import { NextResponse } from "next/server";
import { requireAdminOrTeam } from "@/lib/require-admin";

export async function GET(request: Request) {
  const actor = await requireAdminOrTeam();
  if (!actor) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${siteUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.settings.basic",
      "https://www.googleapis.com/auth/gmail.modify",
    ].join(" "),
    // offline + consent: force a refresh_token on every connect, so
    // reconnecting always heals a dead grant.
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
