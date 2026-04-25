"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, ExternalLink, Globe } from "lucide-react";
import { updateDinnerField, searchMembersForSpeaker, addDinnerSpeaker, removeDinnerSpeaker } from "./actions";
import { formatName } from "@/lib/format";
import MemberAvatar from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Speaker = {
  member_id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  linkedin_profile: string | null;
  company_website: string | null;
  profile_pic_url: string | null;
};

export default function DinnerDetails({
  dinnerId,
  title,
  description,
  speakers,
}: {
  dinnerId: string;
  title: string | null;
  description: string | null;
  speakers: Speaker[];
}) {
  return (
    <div className="space-y-4">
      <div className="tv-eyebrow border-b border-border-subtle pb-2">Dinner Details</div>
      <InlineTextField
        dinnerId={dinnerId}
        field="title"
        label="Title"
        value={title}
        multiline={false}
      />
      <InlineTextField
        dinnerId={dinnerId}
        field="description"
        label="Description"
        value={description}
        multiline
      />
      <SpeakersSection dinnerId={dinnerId} initialSpeakers={speakers} />
    </div>
  );
}

// ── Inline Text Field ──

function InlineTextField({
  dinnerId,
  field,
  label,
  value,
  multiline,
}: {
  dinnerId: string;
  field: "title" | "description";
  label: string;
  value: string | null;
  multiline: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value);
  const [draft, setDraft] = useState(value ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateDinnerField(dinnerId, field, draft.trim() || null);
      if (result.success) {
        setCurrent(draft.trim() || null);
        setEditing(false);
      }
    });
  }

  function handleCancel() {
    setDraft(current ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <span className="text-xs font-medium uppercase text-fg3">{label}</span>
        {multiline ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") handleCancel();
            }}
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
        )}
        <div className="flex gap-2">
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
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-pointer group"
    >
      <span className="text-xs font-medium uppercase text-fg3">{label}</span>
      <p className="text-sm text-fg1 mt-0.5 group-hover:text-fg2 group-hover:underline">
        {current || <span className="text-fg4 italic">Click to add {label.toLowerCase()}</span>}
      </p>
    </div>
  );
}

// ── Speakers Section ──

function SpeakersSection({
  dinnerId,
  initialSpeakers,
}: {
  dinnerId: string;
  initialSpeakers: Speaker[];
}) {
  const [speakers, setSpeakers] = useState(initialSpeakers);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; company_name: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => { setSpeakers(initialSpeakers); }, [initialSpeakers]);

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchMembersForSpeaker(q).then((r) => {
      // Filter out members who are already speakers
      const speakerIds = new Set(speakers.map((s) => s.member_id));
      setResults(r.filter((m) => !speakerIds.has(m.id)));
      setSearching(false);
    });
  }, [speakers]);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search, doSearch]);

  function handleAdd(memberId: string, name: string) {
    startTransition(async () => {
      const result = await addDinnerSpeaker(dinnerId, memberId);
      if (result.success) {
        setSearch("");
        setResults([]);
        setShowSearch(false);
      }
    });
  }

  function handleRemove(memberId: string) {
    startTransition(async () => {
      const result = await removeDinnerSpeaker(dinnerId, memberId);
      if (result.success) {
        setSpeakers((prev) => prev.filter((s) => s.member_id !== memberId));
        setConfirmRemove(null);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase text-fg3">Speakers</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setShowSearch(!showSearch)}
        >
          {showSearch ? "Cancel" : "Add Speaker"}
        </Button>
      </div>

      {/* Speaker search */}
      {showSearch && (
        <div className="mb-3">
          <Input
            placeholder="Search members by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {searching && (
            <p className="mt-1 text-xs text-fg4">Searching...</p>
          )}
          {results.length > 0 && (
            <div className="mt-1 max-h-48 overflow-auto rounded-md border border-border">
              {results.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleAdd(m.id, m.name)}
                  disabled={isPending}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left cursor-pointer hover:bg-bg-elevated"
                >
                  <div>
                    <div className="text-sm font-medium text-fg1">{m.name}</div>
                    <div className="text-xs text-fg3">{m.company_name || "\u2014"}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {search.length >= 2 && !searching && results.length === 0 && (
            <p className="mt-1 text-xs text-fg4">No members found.</p>
          )}
        </div>
      )}

      {/* Speaker list */}
      {speakers.length === 0 && !showSearch && (
        <p className="text-sm text-fg4 italic">No speakers added.</p>
      )}
      <div className="space-y-2">
        {speakers.map((s) => (
          <div
            key={s.member_id}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
          >
            <MemberAvatar
              member={{ first_name: s.first_name, last_name: s.last_name, profile_pic_url: s.profile_pic_url }}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <Link href={`/admin/members/${s.member_id}`} className="text-sm font-medium text-fg1 no-underline hover:text-accent-hover hover:underline">
                {formatName(s.first_name, s.last_name)}
              </Link>
              {s.company_name && (
                <div className="text-xs text-fg3">{s.company_name}</div>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                {s.linkedin_profile && (
                  <a
                    href={s.linkedin_profile.startsWith("http") ? s.linkedin_profile : `https://${s.linkedin_profile}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-fg3 no-underline hover:text-fg1 hover:border-accent transition-colors duration-[120ms]"
                  >
                    <ExternalLink size={12} /> LinkedIn
                  </a>
                )}
                {s.company_website && (
                  <a
                    href={s.company_website.startsWith("http") ? s.company_website : `https://${s.company_website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-fg3 no-underline hover:text-fg1 hover:border-accent transition-colors duration-[120ms]"
                  >
                    <Globe size={12} /> Website
                  </a>
                )}
              </div>
            </div>
            {confirmRemove === s.member_id ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleRemove(s.member_id)}
                  disabled={isPending}
                  className="!bg-ember-600 hover:!bg-ember-600/90 !text-xs"
                >
                  Confirm
                </Button>
                <button
                  onClick={() => setConfirmRemove(null)}
                  className="text-xs text-fg3 cursor-pointer hover:text-fg1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRemove(s.member_id)}
                className="text-fg4 cursor-pointer hover:text-ember-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
