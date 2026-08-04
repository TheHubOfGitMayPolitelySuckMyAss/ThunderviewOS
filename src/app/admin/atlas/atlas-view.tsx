"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { AtlasNode, DocketSection } from "@/lib/atlas/read";

// Client half of /admin/atlas: domain cards (Why/What at rest) → feature
// cards → How/Decisions/Graveyard behind per-section toggles; Docket tab
// with Done collapsed. All content arrives pre-rendered as HTML from the
// server page.

const PROSE =
  "text-sm leading-relaxed text-fg2 [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 " +
  "[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_hr]:my-3 [&_hr]:border-border " +
  "[&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-medium [&_h4]:mb-1 [&_h4]:mt-2 [&_h4]:font-medium " +
  "[&_code]:rounded [&_code]:bg-bg-elevated [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] " +
  "[&_a]:underline [&_a]:text-accent-hover [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-fg3 " +
  "[&_strong]:text-fg1";

function cn(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "live") return null;
  const cls =
    status === "deprecated"
      ? "border-red-300 bg-red-50 text-red-700"
      : "border-border text-fg3"; // parked & anything else
  return (
    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px]", cls)}>
      {status}
    </span>
  );
}

/** One How/Decisions/Graveyard section behind its own toggle — closed by default. */
function SectionToggle({ label, html }: { label: string; html: string | null }) {
  const [open, setOpen] = useState(false);
  if (!html) return null;
  return (
    <div className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 py-2 text-left text-[13px] font-medium text-fg3 hover:text-fg1"
      >
        <ChevronRight
          size={12}
          className={cn("shrink-0 transition-transform duration-[120ms]", open && "rotate-90")}
        />
        {label}
      </button>
      {open && (
        <div className={cn(PROSE, "pb-3 pl-5")} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}

/** A feature node: Why/What at rest, sections + children behind expansion. */
function NodeCard({ node, depth = 0 }: { node: AtlasNode; depth?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("rounded-lg border border-border bg-bg", depth > 0 && "ml-4")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full cursor-pointer px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            size={13}
            className={cn(
              "shrink-0 text-fg3 transition-transform duration-[120ms]",
              open && "rotate-90"
            )}
          />
          <span className="text-[15px] font-medium text-fg1">{node.title}</span>
          <StatusBadge status={node.status} />
          {node.children.length > 0 && (
            <span className="text-xs text-fg3">
              {node.children.length} sub-feature{node.children.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="mt-1 space-y-0.5 pl-[21px] text-[13px]">
          {node.why && (
            <p className="text-fg3">
              <span className="font-medium text-fg2">Why&nbsp;</span>
              {node.why}
            </p>
          )}
          {node.what && (
            <p className="text-fg3">
              <span className="font-medium text-fg2">What&nbsp;</span>
              {node.what}
            </p>
          )}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 pl-[37px]">
          <SectionToggle label="How it works" html={node.howHtml} />
          <SectionToggle label="Decisions" html={node.decisionsHtml} />
          <SectionToggle label="Graveyard" html={node.graveyardHtml} />
          {node.children.length > 0 && (
            <div className="mt-2 space-y-2 border-t border-border pt-3">
              {node.children.map((c) => (
                <NodeCard key={c.slug} node={c} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A domain: Why / What visible at rest, features on expand. */
function DomainCard({ domain }: { domain: AtlasNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-border bg-bg shadow-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full cursor-pointer px-4 py-3.5 text-left md:px-5"
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 text-fg3 transition-transform duration-[120ms]",
              open && "rotate-90"
            )}
          />
          <span className="text-base font-medium text-fg1 md:text-[15px]">{domain.title}</span>
          {domain.children.length > 0 && (
            <span className="shrink-0 rounded-full bg-bg-elevated px-2 py-0.5 text-[11px] text-fg2">
              {domain.children.length}
            </span>
          )}
          <StatusBadge status={domain.status} />
        </div>
        <div className="mt-1.5 space-y-0.5 pl-[26px] text-[13px] text-fg3">
          {domain.why && (
            <p>
              <span className="font-medium text-fg2">Why&nbsp;</span>
              {domain.why}
            </p>
          )}
          {domain.what && (
            <p>
              <span className="font-medium text-fg2">What&nbsp;</span>
              {domain.what}
            </p>
          )}
        </div>
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-4 md:px-5">
          <div className="ml-[26px] border-t border-border pt-3">
            <SectionToggle label="How it works" html={domain.howHtml} />
            <SectionToggle label="Decisions" html={domain.decisionsHtml} />
            <SectionToggle label="Graveyard" html={domain.graveyardHtml} />
          </div>
          {domain.children.map((n) => (
            <NodeCard key={n.slug} node={n} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AtlasView({
  domains,
  docket,
}: {
  domains: AtlasNode[];
  docket: DocketSection[];
}) {
  const [tab, setTab] = useState<"atlas" | "docket">("atlas");
  const [doneOpen, setDoneOpen] = useState(false);

  const doneSection = docket.find((s) => s.title.toLowerCase().startsWith("done"));
  const liveSections = docket.filter((s) => !s.title.toLowerCase().startsWith("done"));

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("atlas")}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-sm",
            tab === "atlas"
              ? "bg-ink-900 font-medium text-cream-50"
              : "border border-border text-fg2 hover:bg-bg-elevated"
          )}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => setTab("docket")}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-sm",
            tab === "docket"
              ? "bg-ink-900 font-medium text-cream-50"
              : "border border-border text-fg2 hover:bg-bg-elevated"
          )}
        >
          Docket
        </button>
      </div>

      {tab === "atlas" && (
        <div>
          {domains.length === 0 && (
            <p className="text-sm text-fg3">
              No atlas nodes yet — see docs/atlas/README.md for the convention.
            </p>
          )}
          {domains.map((d) => (
            <DomainCard key={d.slug} domain={d} />
          ))}
        </div>
      )}

      {tab === "docket" && (
        <div className="space-y-4">
          {liveSections.map((s) => (
            <div key={s.title} className="rounded-lg border border-border bg-bg p-4 shadow-xs">
              <h2 className="mb-2 text-[15px] font-medium text-fg1">{s.title}</h2>
              {s.html ? (
                <div className={PROSE} dangerouslySetInnerHTML={{ __html: s.html }} />
              ) : (
                <p className="text-sm text-fg3">Empty.</p>
              )}
            </div>
          ))}
          {doneSection && (
            <div className="rounded-lg border border-border bg-bg px-4 py-2 shadow-xs">
              <button
                type="button"
                onClick={() => setDoneOpen((v) => !v)}
                className="flex w-full cursor-pointer items-center gap-2 py-1 text-left text-[15px] font-medium text-fg2 hover:text-fg1"
              >
                <ChevronRight
                  size={12}
                  className={cn(
                    "shrink-0 text-fg3 transition-transform duration-[120ms]",
                    doneOpen && "rotate-90"
                  )}
                />
                Done
                <span className="text-xs font-normal text-fg3">shipped, newest first</span>
              </button>
              {doneOpen && (
                <div
                  className={cn(PROSE, "pb-2 pl-5")}
                  dangerouslySetInnerHTML={{ __html: doneSection.html }}
                />
              )}
            </div>
          )}
          {docket.length === 0 && (
            <p className="text-sm text-fg3">No docket yet — docs/docket.md.</p>
          )}
        </div>
      )}
    </div>
  );
}
