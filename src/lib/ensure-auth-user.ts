import { createAdminClient } from "./supabase/admin";

/**
 * Ensure an auth.users row exists for the given email.
 * If the user already exists, this is a no-op.
 * Uses the service role client's admin API.
 */
export async function ensureAuthUser(email: string): Promise<void> {
  const admin = createAdminClient();
  const normalized = email.toLowerCase();

  // createUser with email_confirm: true is idempotent-ish —
  // it errors with "User already registered" if the email exists.
  const { error } = await admin.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
  });

  // "User already registered" is expected and safe to ignore
  if (error && !error.message.includes("already been registered")) {
    console.error(`ensureAuthUser failed for ${normalized}:`, error.message);
  }
}
