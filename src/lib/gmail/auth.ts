/**
 * Google OAuth token management for sending mail as Eric via the Gmail API.
 *
 * Ported from DigiEric (apps/web/lib/google-auth.ts) — same Google Cloud OAuth
 * client (GOOGLE_CLIENT_ID/SECRET shared across both apps), but Thunderview
 * holds its OWN grant: its own refresh token in its own single-row
 * google_oauth_tokens table. The two apps never read each other's databases.
 *
 * Table is service-role only (RLS enabled, zero policies) — raw tokens must
 * never be readable by the authenticated role.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

/** True if a space-delimited OAuth scope string grants gmail.send. */
export function scopeCanSend(scope: string | null | undefined): boolean {
  if (!scope) return false;
  return scope.split(/\s+/).includes(SEND_SCOPE);
}

export type GmailConnection =
  | { connected: false }
  | { connected: true; scopeOk: boolean; connectedAt: string | null };

/**
 * Cheap connection check for UI: is there a stored grant, and does it carry
 * gmail.send? Does not hit Google — scope is checked against the stored grant
 * string (Google returns the granted scopes at token-exchange time).
 */
export async function getGmailConnection(): Promise<GmailConnection> {
  const admin = createAdminClient("read-only");
  const { data } = await admin
    .from("google_oauth_tokens")
    .select("scope, created_at")
    .eq("lock", true)
    .maybeSingle();

  if (!data) return { connected: false };
  return {
    connected: true,
    scopeOk: scopeCanSend(data.scope),
    connectedAt: data.created_at ?? null,
  };
}

/**
 * Return a live access token, refreshing via the stored refresh token when the
 * cached one is expired (60s buffer). Throws when no grant exists or refresh
 * fails — callers treat that as "Gmail disconnected" and surface it loudly.
 */
export async function getAccessToken(): Promise<string> {
  const admin = createAdminClient("system-internal");
  const { data, error } = await admin
    .from("google_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("lock", true)
    .single();

  if (error || !data) {
    throw new Error("Gmail is not connected (no Google OAuth token stored)");
  }

  if (
    data.expires_at &&
    new Date(data.expires_at) > new Date(Date.now() + 60_000)
  ) {
    return data.access_token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${err}`);
  }

  const tokens = await res.json();

  await admin
    .from("google_oauth_tokens")
    .update({
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("lock", true);

  return tokens.access_token;
}
