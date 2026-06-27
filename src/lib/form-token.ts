import crypto from "crypto";

/**
 * Signed timing token for the public application form.
 *
 * The apply form is an unauthenticated server action — anything can POST it.
 * To quiet automated spam without adding user-visible friction (no CAPTCHA,
 * no third-party account), the form carries a server-issued token stamped with
 * the time the page was rendered. On submit we verify the signature and the
 * elapsed time: a real human takes seconds-to-minutes to fill a 12-field form;
 * a bot that fires instantly (or replays a stale token hours later) fails.
 *
 * Paired with the honeypot field in the form, this catches the bulk of
 * low-effort form spam. Spam submissions are dropped silently (the caller
 * returns a normal "thanks" response) so bots can't tell they were filtered.
 *
 * Secret reuses the already-provisioned UNSUBSCRIBE_SECRET (same
 * possession-of-a-signed-blob threat model) so no new Vercel env var is
 * required. Prefers a dedicated FORM_TOKEN_SECRET if ever set.
 */
const SECRET =
  process.env.FORM_TOKEN_SECRET ||
  process.env.UNSUBSCRIBE_SECRET ||
  "thunderview-form-token-default-key";

function sign(issuedAt: string): string {
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(issuedAt);
  return hmac.digest("hex");
}

/** Mint a fresh token stamped with the current time (ms epoch). */
export function generateFormToken(): string {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt)}`;
}

/**
 * Verify the signature and return the token's age in milliseconds.
 * Returns null if the token is malformed or the signature doesn't match.
 */
export function verifyFormToken(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [issuedAt, sig] = parts;
  if (!/^\d+$/.test(issuedAt)) return null;

  const expected = sign(issuedAt);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  return Date.now() - Number(issuedAt);
}
