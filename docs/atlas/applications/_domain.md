---
title: Applications
why: The program vets every would-be attendee; the vetting record has to persist forever, because rejected applicants re-apply and demographics collected at vetting time must never leak onto member records.
what: A public apply form whose submissions land in an admin queue and get approved (member created/rebound) or rejected (suppressed) — with spam never reaching the queue at all.
status: live
---

## How

Public form at `/apply` (`src/app/apply/`). Before any insert, two silent
gates drop bots: a hidden honeypot field and an HMAC-signed timing token
(`MIN_FILL_MS=3s`, `MAX_AGE_MS=12h`, minted per render, `src/lib/form-token.ts`);
drops return the normal success page so the bot can't tell
(`application.spam_blocked` in system_events is the only trace). An email
matching an active member short-circuits to `/apply/already-member` — no row,
no notification. Kicked-out re-applications fall through and get a red pill
in the admin queue.

Pending applications can be handled three ways: the admin UI at
`/admin/applications/[id]`; one-click Approve/Reject links in the
notification email (signed tokens over `applicationId:action`, GET renders a
confirm page, mutation is a POST server action so scanners can't fire it);
or "Delete as spam" — the ONLY hard delete in the system, pending-only,
because rejecting spam would email the spammer and suppress a shared address.
Core approve/reject logic is shared in `src/lib/application-review.ts`.

Rejected applications stay forever — that table IS the suppression list.
Demographics live on applications only, never copied to members.

## Decisions

- **2026-05-08** — Active members short-circuit at submission; kicked-out
  re-applications flagged in the queue instead. (4bf8c4c)
- **2026-05-12** — "Delete as spam" added as a narrow exception to
  no-row-deletions: reject-with-email is the wrong tool for spam. (148e5e1)
- **2026-06-17** — Approve/Reject one-click links in the notification email;
  GET-safe confirm page + POST mutation so email scanners can't approve.
  (1133fc3)
- **2026-06-27** — Anti-spam gate: honeypot + signed timing token, dropped
  silently with a fake success. No CAPTCHA — zero friction for real
  applicants. (7eb7e50)

## Graveyard

- **CAPTCHA / third-party bot service** — rejected for friction and account
  overhead; honeypot + timing token first, Cloudflare Turnstile is the named
  next lever only if low-effort bots persist. (7eb7e50)
