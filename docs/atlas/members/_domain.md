---
title: Members
why: Approved people need one durable identity across many email addresses, applications, and years of standing — and every outbound system needs to know exactly which segment each person is in.
what: A members table that is the single source of current standing (multi-email, soft-delete only), with every member landing in exactly one stage bucket for segmentation.
status: live
---

## How

Three-table model: `applications` (vetting events, forever), `members`
(current standing), `tickets` (paid entry). Members are never row-deleted —
`kicked_out` is the soft delete.

Multi-email via `member_emails`: auth, ticket matching, and application
matching all look up against EVERY address (`findMemberByAnyEmail`,
`src/lib/member-lookup.ts`). Primary = email on the most recent approved
application; hard bounce on primary auto-promotes the most recent active
secondary (`swap_primary_email` RPC). Every address needs its own
`auth.users` row (`ensureAuthUsersForMember`) or magic-link login fails.

Segmentation is the stage ladder (`computeStageForMember`,
`src/lib/member-stage.ts`): 9 buckets, first match wins — team → opted_out →
bounced → has_ticket → not_this_one → investors → attended → approved.
Consumed by the mail-merge audience engine.

Profile text (intro/ask/give) is AI-summarized on save into `*_short`
columns for the directory (`src/lib/summarize-profile.ts`, failures logged
and swallowed — the save always completes).

## Decisions

- **2026-05-08** — Directory shorts AI-generated on save; 60-char hard clamp
  dropped same day (truncated mid-word, worse than long). (67918c0, f39bb95)
- **2026-05-18** — Hard bounce on primary auto-promotes a secondary; manual
  bounce path added for non-webhook bounces. (136c06f)
- **2026-07-13** — Streak integration ripped out (subscription cancelled;
  mail merges replaced it). `streak_box_key` columns remain as dead data —
  don't build on them. (3b3ec54)
- **2026-08-01** — Admin delete of a member email is a hard DELETE;
  `email_events.member_email_id` went `ON DELETE SET NULL` so events survive.
  Deleting a bounced address forgets the suppression. (913e951)

## Graveyard

- **Filtering `member_emails` by `is_primary = true` in auth contexts** — the
  canonical bug shape; silently breaks login via secondary address. Use
  `findMemberByAnyEmail` always.
- **Inferring audience size from the "~40-member" program figure** — the
  marketing audience is ~10x the dinner community; query, never infer.
