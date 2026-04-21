"use client";

import { useState, useTransition } from "react";
import { updateDinnerField } from "./actions";

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
    <p className="text-sm text-gray-500">
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
          className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={handleCancel}
          className="rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:text-gray-700 hover:underline"
    >
      {current}
    </span>
  );
}
