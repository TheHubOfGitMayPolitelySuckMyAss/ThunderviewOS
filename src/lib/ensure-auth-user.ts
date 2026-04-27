import { createAdminClient } from "./supabase/admin";

/**
 * Ensure an auth.users row exists for the given email.
 * If the user already exists, this is a no-op.
 * Uses the service role client's admin API.
 *
 * Gotcha: Supabase admin.createUser leaves email_change and
 * email_change_token_new as NULL, but GoTrue's Go code scans them
 * into non-nullable strings, causing "Database error finding user"
 * on OTP requests. We patch these via updateUserById after creation.
 */
export async function ensureAuthUser(email: string): Promise<void> {
  const admin = createAdminClient();
  const normalized = email.toLowerCase();

  // createUser with email_confirm: true is idempotent-ish —
  // it errors with "User already registered" if the email exists.
  const { data, error } = await admin.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
  });

  // "User already registered" is expected and safe to ignore
  if (error && !error.message.includes("already been registered")) {
    console.error(`ensureAuthUser failed for ${normalized}:`, error.message);
    return;
  }

  // Patch nullable string columns that GoTrue expects to be non-null.
  // updateUserById triggers GoTrue to normalize these fields.
  if (data?.user?.id) {
    await admin.auth.admin.updateUserById(data.user.id, {}).catch((err) => {
      // Non-fatal — user is created, login may need manual DB fix
      console.error(`ensureAuthUser patch failed for ${normalized}:`, err);
    });
  }
}
