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
