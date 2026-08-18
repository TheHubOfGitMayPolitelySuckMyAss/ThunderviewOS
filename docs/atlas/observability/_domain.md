---
title: Observability
why: A one-operator system can't afford silent failures or unattributed changes — Eric has to be able to ask "what happened, who did it, did the cron fire" and get an answer from inside the app.
what: Every mutation audited with an actor, every failure loud in one feed, every page view and visitor traceable — three feeds over one union view.
status: live
---

## How

**Audit**: `audit.row_history` snapshots OLD/NEW JSONB on 9 tables; triggers
named `zzz_audit_row_change` to fire last. Human actions attribute via the
`X-Audit-Actor` header (`createAdminClientForCurrentActor()`); everything
else declares a reason (`cron`/`webhook`/`public-flow`/…) — the choice is
forced at every callsite.

**Feeds**: People / System / Marketing at `/admin/operations`, all filtered
in `getActivityFeed` (`src/lib/activity-feed/`) over system_events ∪
email_events ∪ audit. `error.caught` is the universal failure type; the
System feed is an explicit inclusion list, never a wildcard. Crons emit one
heartbeat row per fire (per-minute crons: only when they did work).

**Page views**: client-component logger in three layouts; anonymous
visitors get an `anon_id` cookie, bridged to the member once at
`auth.login`. Marketing feed = rows carrying an anon_id.

## Decisions

- **2026-05-08** — Anon→member bridge happens once, on the login event; no
  backfill of prior anonymous views. Visitors render as colored 8-hex
  handles. (c463c72, 6fd5dbc)
- **2026-05-11** — Soft bounces split out of the System feed (view-level
  reclassification by bounce type); bounce cascade emits explicit events so
  the feed shows what we DID; post-success PKCE replays suppressed from
  `auth.login_failed`. (d515b27, c251fde, 2d4fcd5)
- **2026-05-18** — Page views capture user_agent + IP: users are
  authenticated members, and "which device hung on X's profile" should be
  one query. (548853a)
- **2026-08-18** — Magic-link requests are logged (`auth.magic_link_requested`,
  written by `logMagicLinkRequest` from the login form after `signInWithOtp`
  succeeds), and a 2-minute cron emails Eric when one has no `auth.login`
  after it for 10 minutes. Rationale: `signInWithOtp` is a browser→Supabase
  call, so a link that can never work leaves NO trace on our side — no
  `/auth/confirm` hit, no `auth.login_failed`, nothing. Absence of a success
  is the only observable. Threshold is Eric's call over a proposed 60m:
  reaching a stuck person while they're still at their desk beats a quiet
  inbox, and the email says to re-check whether they got in. Metadata carries
  `origin` so a non-allow-listed host is visible on the alert itself. Dedupe:
  one alert per member per 24h.

## Graveyard

- **Server-component page tracking** — doesn't work in Next 16 App Router
  (layouts don't rerender on intra-layout nav); must be a client component.
- **Per-cron failure event types** (`cron.<name>.failed`) — rejected;
  `error.caught` with `metadata.cause` is the single failure indicator.
- **Prefix/wildcard System-feed inclusion** — rejected; operator-relevant
  events are added explicitly or the feed drowns.
- **Privacy-strict logger (no UA/IP)** — that's the VibeClaude extension's
  design, not this app's; members are authenticated, headers are signal.
