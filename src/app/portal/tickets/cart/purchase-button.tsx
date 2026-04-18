"use client";

import { useTransition } from "react";
import { purchaseTicket } from "./actions";

export default function PurchaseButton({ withGuest }: { withGuest: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => purchaseTicket(formData))}
    >
      <input type="hidden" name="with_guest" value={String(withGuest)} />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {isPending ? "Processing..." : "Purchase"}
      </button>
    </form>
  );
}
