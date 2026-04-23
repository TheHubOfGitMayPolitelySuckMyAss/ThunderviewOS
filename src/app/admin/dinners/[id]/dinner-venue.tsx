"use client";

import { useState, useTransition } from "react";
import { updateDinnerField } from "./actions";
import { Button } from "@/components/ui/button";

export default function DinnerVenue({
  dinnerId,
  venue,
  address,
}: {
  dinnerId: string;
  venue: string;
  address: string;
}) {
  return (
    <p className="text-sm text-fg3">
      <InlineField dinnerId={dinnerId} field="venue" value={venue} />
      {" @ "}
      <InlineField dinnerId={dinnerId} field="address" value={address} />
    </p>
  );
}

function InlineField({
  dinnerId,
  field,
  value,
}: {
  dinnerId: string;
  field: "venue" | "address";
  value: string;
}) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value);
  const [draft, setDraft] = useState(value);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateDinnerField(dinnerId, field, draft);
      if (result.success) {
        setCurrent(draft);
        setEditing(false);
      }
    });
  }

  function handleCancel() {
    setDraft(current);
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="rounded-md border border-border px-2 py-0.5 text-sm text-fg1 bg-bg focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgba(181,131,90,0.18)]"
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
      </span>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:text-fg2 hover:underline"
    >
      {current}
    </span>
  );
}
