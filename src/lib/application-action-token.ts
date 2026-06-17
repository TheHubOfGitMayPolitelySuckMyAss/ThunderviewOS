import crypto from "crypto";

/**
 * Signed tokens for the one-click application Approve/Reject links in the
 * admin new-application notification email.
 *
 * The link only opens a confirmation page (a GET that mutates nothing — safe
 * from email-client / security-scanner prefetch). The actual approve/reject
 * runs from a POST server action on that page, which re-verifies the token.
 *
 * Token is scoped to BOTH the application id AND the action, so an "approve"
 * link can never be replayed as a "reject" (and vice versa).
 *
 * Secret: prefers a dedicated APPLICATION_ACTION_SECRET, falls back to the
 * already-provisioned UNSUBSCRIBE_SECRET so this never runs on a forgeable
 * default in production. Same possession-of-the-emailed-link threat model as
 * the unsubscribe link.
 */
const SECRET =
  process.env.APPLICATION_ACTION_SECRET ||
  process.env.UNSUBSCRIBE_SECRET ||
  "thunderview-app-action-default-key";

export type ApplicationAction = "approve" | "reject";

function sign(applicationId: string, action: ApplicationAction): string {
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(`${applicationId}:${action}`);
  return hmac.digest("hex");
}

export function generateApplicationActionToken(
  applicationId: string,
  action: ApplicationAction
): string {
  return `${applicationId}.${action}.${sign(applicationId, action)}`;
}

export function verifyApplicationActionToken(
  token: string
): { applicationId: string; action: ApplicationAction } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [applicationId, action, sig] = parts;
  if (action !== "approve" && action !== "reject") return null;

  const expected = sign(applicationId, action as ApplicationAction);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  return { applicationId, action: action as ApplicationAction };
}
