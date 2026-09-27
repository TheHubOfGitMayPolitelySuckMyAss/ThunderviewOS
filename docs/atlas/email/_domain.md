---
title: Email
why: Every program touchpoint outside the dinner itself is email — transactional lifecycle, marketing sends, and Eric's personal one-to-one merges — and each kind has different deliverability, audience, and immutability rules.
what: Three send systems (transactional via Resend templates, marketing via dedicated per-type tables, mail merge via Eric's Gmail) plus bounce handling and in-inbox ops, none of which can contact someone who opted out or bounced.
status: live
---

## How

**Transactional** (Resend, from team@): seven templates editable at
`/admin/emails/*`, `[member.field]` placeholders, shared HTML shell
(`bodyToHtml`). Crons drive the lifecycle sends (fulfillment, morning-of,
prompt-intro-ask at T-2 days, applied-didnt-convert at T-6 days).

**Marketing** (Resend): dedicated table per type (`monday_before_emails`,
`monday_after_emails`, `one_off_blast_emails`) — macro seeds draft,
sent-lock trigger makes sent rows immutable, `audience_snapshot` JSONB
frozen at send. `NEXT_PUBLIC_EMAIL_MODE=testing` restricts to team.

**Mail merge** (Gmail API, from whichever admin/team member connected their
Gmail — in practice Eric): personal-looking sends to stage-ladder buckets; async queue
(`mail_merge_recipients`). Throttled to `MAIL_MERGE_SENDS_PER_MINUTE` (5)
per rolling minute across all merges, enforced atomically by the claim-one
RPC `claim_mail_merge_recipient_throttled`; each drain run (inline at send
start, then every per-minute cron fire) sends at most one minute's
allotment, spaced ~10s apart — 500 recipients ≈ 100 minutes. Every merge
send carries a one-click `List-Unsubscribe` header pointing at the same
`/api/unsubscribe` endpoint the Resend marketing footers use (POST = RFC 8058
one-click, no visible footer). Live Gmail signature fetched at send. From
name = Gmail send-as name, else the name of the member who owns the connected
address (any of their emails), else a bare address plus an
`email.sender_name_missing` warning — never a hardcoded name.

**Inbound ops**: Resend webhook (domain-filtered — the account is shared)
handles bounces; hard bounce → `email_status='bounced'` + secondary
promotion; second soft bounce escalates. Gmail labels (TV Bounce / TV Skip /
TV Opt Out) let Eric run member ops from his inbox via the per-minute cron.

## Decisions

- **2026-05-12** — Monday After's CTA promotes the NEXT dinner, not the
  recapped anchor. (e3cc8a7)
- **2026-05-18** — Second soft bounce escalates to the hard-bounce cascade:
  SES classifies dead domains as Transient. (237baa9)
- **2026-06-09** — Monday After shows every attendee's ask, staleness filter
  dropped. (4448340)
- **2026-07-13** — Mail merges moved to Gmail API, replacing Streak; no
  auto-greeting, Eric writes his own (placeholder syntax instead). (5a950f0,
  579e598)
- **2026-07-14** — Gmail label actions: in-email bounce/skip/opt-out ops, no
  admin UI. (8e08cb9, cceddec)
- **2026-07-16** — Label actions act once per (thread, kind), not per
  message — a conversation label arrives as N labeled messages and triple-
  emailed Eric. (51811af)
- **2026-08-08** — Monday Before/After image uploads go browser → storage
  directly (signed upload URL into `email-images/tmp/`, then an attach
  action compresses from storage and deletes the temp). Vercel caps request
  bodies at 4.5MB — verified empirically: 4.3MB POST → 200, 4.7MB → 413 —
  so originals must never travel through a server action; Eric's ~4.5MB
  photos sat exactly on the cap and hung the uploader (the 413 rejected the
  promise, no catch, spinner never cleared). next.config.ts's 5MB
  `bodySizeLimit` never gets a say. Shared plumbing in
  `src/lib/email-image-upload.ts`; compression pipeline unchanged (800px,
  ≤500KB). Uploader now try/catch/finally — failures show, never hang.
- **2026-08-08** — Morning-of email carries a hardcoded venue-tease block
  (two bold body-text lines styled like the Tonight's Attendees label + two
  photos from the `email-images` bucket: `morning-of-venue-{outside,inside}.jpg`)
  between the editable template body and Tonight's Attendees. Not
  template-editable — swap by overwriting the bucket files (same filename =
  same URL) or editing `sendMorningOfEmail`. Eric iterated size down from
  Fraunces h2 24px → settled on the plain label style. (5cee2dc..c957bbc)
- **2026-08-18** — All six transactional templates still linked to the
  pre-cutover `thunderview-os.vercel.app` host, three months after the
  2026-05-08 domain move. That host still serves production but is NOT in
  Supabase's redirect allow-list, so a magic link requested from it has its
  `redirect_to` silently swapped for Site URL — `/auth/confirm` never runs and
  the member loops back to the login form. Reported by a new member; found via
  GoTrue `/otp` logs, where the `referer` field carries the requested
  redirect_to. Fixed in three places: template bodies rewritten in the DB, the
  `NEXT_PUBLIC_SITE_URL` fallback constants in `src/` repointed to the apex,
  and next.config.ts now 308s the whole vercel.app host to the apex (exact
  host match — preview deploys `thunderview-os-git-*` must not match).
  **Any new hardcoded host in an email is this bug waiting to happen — use
  `NEXT_PUBLIC_SITE_URL`.**
- **2026-08-30** — Venue-tease block stays hardcoded but is now VISIBLE on
  `/admin/emails/morning-of`: rendered preview section between the template
  editor and Attendee Intros & Asks, via shared `morningOfVenueTeaseHtml()`
  in `src/lib/email-send.ts` (used by real send, test send, and preview —
  test sends previously omitted the block entirely). First attempt put the
  raw HTML into the editable template body; Eric rejected it hard — no other
  template exposes markup in the textarea. Don't move email markup into
  template bodies; render hardcoded sections as previews on the editor page.
- **2026-08-31** — `has_ticket` is now a selectable mail-merge group (Eric's
  call, reversing the launch-time "ticket-holders are mid-transactional-flow"
  exclusion). One-line engine change: the bucket joined `SELECTABLE_GROUPS`;
  freeze/drain were already bucket-generic. UI checkbox listed first (ladder
  order). Gotcha preserved by precedence: a ticket-holder segments ONLY into
  has_ticket, so "Attended" alone still excludes current ticket-holders —
  reaching everyone means ticking both.
- **2026-09-27** — Mail-merge "stop the bleeding" hygiene after
  deliverability misses, Eric-approved as a set: (1) **From display name** —
  Eric's Gmail send-as `displayName` is empty, so every merge went out as a
  bare `From: eric@marcoullier.com`. The name now resolves from whoever owns
  the connected account (`resolveSenderFromName`): send-as name → the owning
  member's first + last name via `findMemberByAnyEmail` → bare address +
  `email.sender_name_missing` warning (System feed; logged once per test send
  and per merge start, not per drain run). **Never a hardcoded name**: any
  admin/team member can connect their own Gmail, and a fixed "Eric
  Marcoullier" fallback would put Eric's name on their address (Eric caught
  this in the first cut, which shipped exactly that). `formatFromHeader`
  quotes RFC 5322 specials / RFC 2047-encodes non-ASCII (ported from osa's
  `gmail-send.ts`). (2) **List-Unsubscribe + List-Unsubscribe-Post
  (one-click)** on merge sends and their test sends only — never on the
  label-action replies. Reuses the existing HMAC-token `/api/unsubscribe`;
  its POST now answers 200 text instead of redirecting (mail clients aren't
  browsers). No `mailto:` — there's no mailbox that routes to the opt-out
  automatically, and we don't invent one. Still no visible footer. (3)
  **Throttle**: ~1/sec burst (500 in ~9 min) → 5 per rolling minute via a
  new advisory-locked claim RPC, so overlapping drainers can't exceed it;
  claim-one, the 30-min stall reaper and never-retry-stalled all unchanged.
  **The 5/min rate is the agent's default, not Eric's ruling** — one
  constant in `src/lib/mail-merge/pacing.ts`.

## Graveyard

- **Open/click tracking** — deliberately not wired; Apple MPP and corporate
  scanners prefetch pixels, signal is unreliable industry-wide.
- **Local `email.delivered` storage** — Resend's dashboard has aggregates;
  acceptance ≠ inbox placement, which no sender can observe. Measure via
  Postmaster Tools / seed lists — don't build.
- **Custom receipt email** — Stripe's built-in receipt is on; a receipt-kit
  design exists in `design-system/ui_kits/` but don't propose building it.
- **Retrying stalled mail-merge recipients** — auto-failed, never retried:
  the crash window includes "Gmail accepted, we died before recording it,"
  and a retry could double-send.
