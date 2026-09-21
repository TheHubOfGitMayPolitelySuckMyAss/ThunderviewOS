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

- **ON ERIC:** Homepage says "40 seats. Closes when full." (`this-months-dinner.tsx:153`); actual cap is 45 — reconcile the copy or leave it.
- **ON ERIC:** Open /admin/atlas and confirm six domain cards render. If it says "No atlas nodes yet," the `outputFileTracingIncludes` tracing failed in the deployed bundle — tell the agent. Unverifiable from outside auth. ⚠unverified
- **ON ERIC:** Pre-existing untracked paths: `design-system/**`, `scripts/`, `supabase/config.toml`. CLAUDE.md documents design-system/ as repo content, but it has never been committed — commit or gitignore?
- **ON ERIC:** 17 members approved since the 2026-05-08 cutover have never logged in (upper bound on who the vercel.app link bug stranded; 3 hold tickets: Bart Lorange, Matt McCall, Steven Nichols). Now that it's fixed they'd get in if they retried, but nobody retries unprompted — email them or let it go?
- **ON ERIC:** End-to-end proof of the login-stall alert is unrun: request a magic link on the live site, don't click it, expect "Login stuck: Eric Marcoullier" ~12 min later. Route + query + auth verified in prod ({"ran":true,"checked":0,"alerted":0}); the send path is untested. ⚠unverified
- **ON ERIC:** Duplicate members are creatable by design — a re-application from a NEW email address makes a second member (`approve_application` matches on email only). Happened 2026-08-18 (Phillip Klein, hotmail + ptarmigan-clockworks); merged by hand. Want LinkedIn-URL matching at approval, or a merge tool, or keep doing it by hand?

## Done

- 2026-09-21 — CoachingOS webhook push replaced by a monthly CSV upload to Known Quantity (`known-quantity-csv` cron, morning after each dinner, rolling 90 days, one row per person). Verified live end-to-end: 79 attendees sent, 79 parsed, `upload_id bd7d2417`. Their parser miscounts newlines inside quoted fields, so every field is flattened to one line. No-show re-arm loop and its column deleted. First scheduled run: 2026-10-02. (atlas: dinners/_domain, 0eb7e4e)
- 2026-08-31 — "Has Ticket" is now a selectable mail-merge group (reverses the launch exclusion; Eric's call). Verified live: first checkbox, 39 ticket-holders for Sep 3. Ladder gotcha: ticket-holders are ONLY in has_ticket — Attended alone excludes them. (atlas: email/_domain, 8619eff)
- 2026-08-30 — Morning-of venue tease now visible on `/admin/emails/morning-of` as a rendered preview (shared `morningOfVenueTeaseHtml()`; test sends include it too — they silently omitted it before). First attempt put raw HTML in the template body; rejected — never expose markup in template textareas. Verified live in browser. (atlas: email/_domain, c6e7c2e+113c67c)
- 2026-08-18 — Login-stall alerting: `auth.magic_link_requested` logged on send, `/api/cron/login-stalled` (every 2 min) emails Eric when a request has no `auth.login` after 10 min. Threshold is Eric's call over a proposed 60m. (atlas: observability/_domain, 542b6ac)
- 2026-08-18 — Migration drift closed: the two applied-but-uncommitted files backfilled, repo now describes the DB in both directions. `supabase db push` is unsafe (filenames vs recorded versions are separate numbering universes) — documented in `supabase/migrations/README.md`. (9b0e7bb)
- 2026-08-18 — Duplicate Phillip Klein merged into the April member (both emails on one record, ptarmigan primary, dinner history intact); the duplicate shell row was deleted.
- 2026-08-18 — All six transactional templates were still linking to the dead `thunderview-os.vercel.app` host, which silently broke every magic link requested from it; templates + `src/` fallbacks repointed to the apex and the old host now 308s. Verified live. (atlas: email/_domain, 3c8b0b6)

- 2026-08-08 — Email-image uploads rebuilt as direct-to-storage (Vercel 4.5MB body cap was hanging ~4.5MB photos); verified live with a 5.2MB upload on the Monday After draft. (atlas: email/_domain, ea6194d)
- 2026-08-08 — Morning-of email venue-tease block (2 photos + label-style captions) shipped after 4 style iterations; demo-verified in Eric's inbox. (atlas: email/_domain, 5cee2dc..c957bbc)
- 2026-08-08 — Aug 6 cap ask expired unanswered: dinner ran at cap 45 with 46 sold (SOLD OUT stood). No action possible now.
- 2026-08-04 — Atlas renderer at /admin/atlas (ported from knownquantity, no notes inbox) + kit updated to b9fce63 (v7 renderer-default-on ritual).
- 2026-08-04 — Atlas kit installed (origin SHA 0c60614); six domains + seat-cap node seeded from code and git history.
- 2026-08-04 — Per-dinner seat cap shipped: `dinners.seat_cap` default 45, December 80, admin-editable, sold-out derived live. (atlas: tickets/seat-cap)
