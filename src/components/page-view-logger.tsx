"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { logPageView } from "@/app/actions/log-page-view";

/**
 * Fires logPageView when the pathname (or search params) changes.
 *
 * Mounted in three layouts: root, portal, admin. The root layout's instance
 * passes rootLayout=true so it skips /portal/* and /admin/* (those are
 * handled by their own layouts; otherwise we'd double-log).
 *
 * Skip list is pure client-side — paths in the skip list never trigger a
 * server action call.
 */

const UNIVERSAL_SKIP_PREFIXES = [
  "/api/",
  "/auth/confirm",
  "/auth/callback",
  "/admin/operations",
  "/dev/",
];

const ROOT_LAYOUT_ONLY_SKIP_PREFIXES = ["/portal", "/admin"];

function shouldSkip(pathname: string, rootLayout: boolean): boolean {
  for (const p of UNIVERSAL_SKIP_PREFIXES) {
    if (pathname.startsWith(p)) return true;
  }
  if (rootLayout) {
    for (const p of ROOT_LAYOUT_ONLY_SKIP_PREFIXES) {
      if (pathname.startsWith(p)) return true;
    }
  }
  return false;
}

export default function PageViewLogger({
  rootLayout = false,
}: {
  rootLayout?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastLogged = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (shouldSkip(pathname, rootLayout)) return;

    const sp: Record<string, string> = {};
    if (searchParams) {
      for (const [k, v] of searchParams.entries()) {
        sp[k] = v;
      }
    }

    // Dedupe rapid duplicate effects (e.g., StrictMode double-effect in dev)
    const dedupeKey = `${pathname}?${new URLSearchParams(sp).toString()}`;
    if (lastLogged.current === dedupeKey) return;
    lastLogged.current = dedupeKey;

    logPageView({
      path: pathname,
      search_params: Object.keys(sp).length > 0 ? sp : undefined,
    }).catch((err) => {
      // Never break navigation if logging fails
      console.error("[page-view] log failed:", err);
    });
  }, [pathname, searchParams, rootLayout]);

  return null;
}
