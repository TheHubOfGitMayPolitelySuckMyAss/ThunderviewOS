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
      <p className="tv-eyebrow mb-1">Seat Cap</p>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-16 rounded-md border border-border px-2 py-0.5 text-sm text-fg1 bg-bg focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgba(181,131,90,0.18)]"
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
            className="rounded px-2 py-0.5 text-xs font-medium text-fg3 cursor-pointer hover:text-fg1"
          >
            Cancel
          </button>
        </div>
      ) : (
        <p
          onClick={() => setEditing(true)}
          className="font-display font-medium text-[28px] text-fg1 cursor-pointer hover:text-fg2"
          style={{ fontVariationSettings: '"opsz" 72' }}
          title="Click to edit"
        >
          {current}
        </p>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {!editing && seatsSold >= current && (
        <p className="text-xs text-fg3 mt-1">Sold out</p>
      )}
    </div>
  );
}
