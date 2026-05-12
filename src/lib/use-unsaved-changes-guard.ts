"use client";

import { useEffect, useRef } from "react";

/**
 * Guard for editors with manual "Save Draft" buttons.
 *
 * Two protections kick in whenever `enabled` is true (typically
 * `hasEdited && !isSent`):
 *
 * 1. **Debounced auto-save.** Every bump of `version` cancels the pending
 *    timer and starts a fresh `debounceMs` countdown. If the user keeps
 *    typing, the save keeps getting pushed forward. After `debounceMs` of
 *    quiet, `onAutosave` fires. The expected pattern in the caller is to
 *    bump `version` from the same place that toggles `hasEdited = true`
 *    (e.g. `markEdited()` increments a counter).
 *
 * 2. **`beforeunload` warning.** While enabled, the browser intercepts
 *    refresh, tab close, and external-link navigations with its own
 *    "Leave site?" dialog. Does NOT intercept Next.js client-side `<Link>`
 *    navigations (App Router has no API for that yet) — auto-save covers
 *    that gap by pushing latest text to the DB before most navigations.
 *
 * Why a stable ref for the callback: re-declaring an inline closure on
 * every render would otherwise reset the timer on each keystroke even
 * though `version` is what we actually want to trigger on.
 */
export function useUnsavedChangesGuard({
  enabled,
  version,
  onAutosave,
  debounceMs = 1500,
}: {
  enabled: boolean;
  version: number;
  onAutosave: () => void | Promise<void>;
  debounceMs?: number;
}) {
  const onAutosaveRef = useRef(onAutosave);
  onAutosaveRef.current = onAutosave;

  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => {
      onAutosaveRef.current();
    }, debounceMs);
    return () => clearTimeout(id);
  }, [enabled, version, debounceMs]);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the message string and show their own
      // generic "Leave site?" prompt; setting returnValue is what
      // triggers the dialog.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}
