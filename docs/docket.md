# Docket — open work, one screen

The atlas's sibling: what's moving, what's waiting on the owner, what's done.
STATE, not a log. Rules (enforced by the docket contract test + the
single-writer hook):

- **Single-writer:** edited on the default branch only. Branch/worktree
  sessions file one-note-per-file updates in `docs/docket-inbox/`; the
  session that merges folds them in and deletes the notes.
- **Every In Flight / Open entry leads with its ask:** `**ON ERIC:**` /
  `**ON AGENT:**` / `**BLOCKED:**` + one line. Owner entries sort first.
- **Entries stay short** (≤12 lines): history is pointers (decision doc §,
  atlas node, commit), never inline prose.
- **Done things MOVE to Done** (one-liners, newest first) — never annotated
  in place with SHIPPED/RESOLVED stamps.

## In Flight

## Open — Unanswered

- **ON ERIC:** Aug 6 dinner (in 2 days) shows SOLD OUT at 46 seats vs cap 45 — bump its cap on /admin/dinners/[id] if members should still be able to buy.
- **ON ERIC:** Homepage says "40 seats. Closes when full." (`this-months-dinner.tsx:153`); actual cap is 45 — reconcile the copy or leave it.
- **ON ERIC:** Open /admin/atlas and confirm six domain cards render. If it says "No atlas nodes yet," the `outputFileTracingIncludes` tracing failed in the deployed bundle — tell the agent. Unverifiable from outside auth. ⚠unverified
- **ON ERIC:** Pre-existing untracked paths: `design-system/**`, `scripts/`, `supabase/config.toml`. CLAUDE.md documents design-system/ as repo content, but it has never been committed — commit or gitignore?

## Done

- 2026-08-04 — Atlas renderer at /admin/atlas (ported from knownquantity, no notes inbox) + kit updated to b9fce63 (v7 renderer-default-on ritual).
- 2026-08-04 — Atlas kit installed (origin SHA 0c60614); six domains + seat-cap node seeded from code and git history.
- 2026-08-04 — Per-dinner seat cap shipped: `dinners.seat_cap` default 45, December 80, admin-editable, sold-out derived live. (atlas: tickets/seat-cap)
