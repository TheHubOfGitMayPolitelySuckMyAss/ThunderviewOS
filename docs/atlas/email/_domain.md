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

**Mail merge** (Gmail API, from eric@): personal-looking sends to stage-
ladder buckets; async queue (`mail_merge_recipients`, claim-one RPC, ~1/sec,
inline drain + per-minute cron). Live Gmail signature fetched at send.

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
