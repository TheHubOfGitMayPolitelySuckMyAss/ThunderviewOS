"use client";

/**
 * While a merge is 'sending', re-fetch the server component every 5s so the
 * sent/pending counts tick up live. Drops out automatically once the page
 * renders with a non-sending status.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SendingProgress() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
