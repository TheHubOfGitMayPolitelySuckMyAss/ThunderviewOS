"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { promoteAuthEmailToPrimary } from "./actions";

interface Props {
  loginEmail: string;
  primaryEmail: string;
}

const NOOP_SUBSCRIBE = () => () => {};
const HYDRATED_SERVER = () => false;
const HYDRATED_CLIENT = () => true;

export default function PrimaryEmailPrompt({ loginEmail, primaryEmail }: Props) {
  const dismissalKey = `tv:primary-swap-dismissed:${loginEmail.toLowerCase()}`;

  // Hydration gate: render nothing during SSR + first hydration tick to
  // avoid mismatching the server output, then read localStorage on the
  // post-hydration render.
  const hydrated = useSyncExternalStore(NOOP_SUBSCRIBE, HYDRATED_CLIENT, HYDRATED_SERVER);

  const [closedThisSession, setClosedThisSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function dismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(dismissalKey, "1");
    }
    setClosedThisSession(true);
  }

  function handleYes() {
    setError(null);
    startTransition(async () => {
      const result = await promoteAuthEmailToPrimary();
      if (result.success) {
        dismiss();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (!hydrated) return null;
  if (closedThisSession) return null;
  if (typeof window !== "undefined" && localStorage.getItem(dismissalKey)) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative bg-bg border border-border rounded-xl shadow-lg w-[460px] max-w-full p-6">
        <button
          type="button"
          onClick={dismiss}
          disabled={isPending}
          aria-label="Close"
          className="absolute top-3 right-3 p-1 text-fg3 hover:text-fg1 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="tv-h4 mb-3 pr-6">Update your primary email?</h3>

        <p className="text-sm text-fg2 leading-relaxed mb-5">
          Your primary email is set to <strong className="text-fg1">{primaryEmail}</strong> and this is where all email correspondence goes. Would you like to update your primary email to <strong className="text-fg1">{loginEmail}</strong>?
        </p>

        {error && (
          <div className="rounded-md bg-[rgba(192,68,42,0.08)] text-danger text-sm px-4 py-2 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-tight justify-end">
          <Button variant="ghost" onClick={dismiss} disabled={isPending}>
            No, keep it
          </Button>
          <Button onClick={handleYes} disabled={isPending}>
            {isPending ? "Updating…" : "Yes, update it"}
          </Button>
        </div>
      </div>
    </div>
  );
}
