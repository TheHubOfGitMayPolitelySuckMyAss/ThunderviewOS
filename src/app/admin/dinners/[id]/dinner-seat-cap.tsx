"use client";

import { useState, useTransition } from "react";
import { updateDinnerSeatCap } from "./actions";
import { Button } from "@/components/ui/button";

export default function DinnerSeatCap({
  dinnerId,
  seatCap,
  seatsSold,
}: {
  dinnerId: string;
  seatCap: number;
  seatsSold: number;
}) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(seatCap);
  const [draft, setDraft] = useState(String(seatCap));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const parsed = parseInt(draft, 10);
    startTransition(async () => {
      const result = await updateDinnerSeatCap(dinnerId, parsed);
      if (result.success) {
        setCurrent(parsed);
        setEditing(false);
        setError(null);
      } else {
        setError(result.error ?? "Failed to save");
      }
    });
  }

  function handleCancel() {
    setDraft(String(current));
    setError(null);
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-border bg-bg px-5 py-4 shadow-xs">
      <p className="tv-eyebrow mb-1">Purchased</p>
      <p className="font-display font-medium text-[28px] text-fg1" style={{ fontVariationSettings: '"opsz" 72' }}>
        {seatsSold}
      </p>
      {editing ? (
        <div className="mt-1 flex items-center gap-1">
          <span className="text-xs text-fg3">Cap:</span>
          <input
            type="number"
            min={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-14 rounded-md border border-border px-1.5 py-0.5 text-xs text-fg1 bg-bg focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgba(181,131,90,0.18)]"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            Save
          </Button>
          <button
            onClick={handleCancel}
            className="rounded px-1.5 py-0.5 text-xs font-medium text-fg3 cursor-pointer hover:text-fg1"
          >
            Cancel
          </button>
        </div>
      ) : (
        <p
          onClick={() => setEditing(true)}
          className="mt-1 text-xs text-fg3 cursor-pointer hover:text-fg1 hover:underline"
          title="Click to edit"
        >
          Cap: {current}
          {seatsSold >= current && " — sold out"}
        </p>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
