import crypto from "crypto";

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || "thunderview-unsub-default-key";

export function generateUnsubscribeToken(memberId: string): string {
  const hmac = crypto.createHmac("sha256", UNSUBSCRIBE_SECRET);
  hmac.update(memberId);
  return `${memberId}.${hmac.digest("hex")}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;
  const memberId = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  const hmac = crypto.createHmac("sha256", UNSUBSCRIBE_SECRET);
  hmac.update(memberId);
  const expected = hmac.digest("hex");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return memberId;
}

/**
 * Absolute one-click unsubscribe URL for a member: the same /api/unsubscribe
 * endpoint (GET = link click, POST = RFC 8058 one-click) the Resend marketing
 * emails use. Mail merges carry it in the List-Unsubscribe header.
 */
export function buildUnsubscribeUrl(
  memberId: string,
  siteUrl: string = process.env.NEXT_PUBLIC_SITE_URL || "https://thunderviewceodinners.com"
): string {
  const base = siteUrl.trim().replace(/\/+$/, "");
  return `${base}/api/unsubscribe?token=${encodeURIComponent(generateUnsubscribeToken(memberId))}`;
}
