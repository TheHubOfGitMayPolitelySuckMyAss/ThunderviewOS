@AGENTS.md

# Thunderview OS

Thunderview OS is the management system for Thunderview CEO Dinners — monthly startup CEO dinners in Colorado (~40 attendees), organized by Eric Marcoullier. It replaces a fragmented stack of Squarespace forms, Google Sheets, Streak CRM, and Eric's memory. Single source of truth for applications, members, tickets, credits, dinners, and intros/asks. Built on Next.js + Supabase, deployed on Vercel. This is a separate project from CoachingOS/DigiEric — separate repo, separate Supabase project.

## Operating rules (read first)

- Cloud-first. Vercel + Supabase. No local-only scripts or dependencies. Flag any local-only requirement for cloud migration automatically.
- Do NOT invent requirements. Build exactly what's specified. If something seems missing, flag it — don't fill it in.
- When Eric reports a bug, ask at least one clarifying question before offering an explanation. Don't infer the cause.
- Prefer omission over inference. If information is uncertain, say so explicitly.
- Don't validate, praise, or smooth ambiguity. Disagree when warranted.
- Workflow: Eric writes prompts, Claude Code executes. Default assumption: Claude Code does it unless stated otherwise.
- When Eric asks you to find a resource (token, file, config value) for a specific task, finding it is implicit authorization to use it for that task. Don't ask for permission to proceed.

## Canonical spec

The v3 handoff doc is the source of truth for product decisions. It lives outside the repo (in Eric's chat sessions) and Eric will paste relevant sections when needed. The handoff doc supersedes any conflicting comments or assumptions in the codebase.

## Stack

- **Next.js 16.2.3**, App Router, TypeScript
- **Tailwind CSS 4** (via `@tailwindcss/postcss`)
- **Supabase**: `@supabase/supabase-js` ^2.103.2, `@supabase/ssr` ^0.10.2
- **Resend** ^6.11.0 (installed, not yet wired)
- **Hosting**: Vercel (production: https://thunderview-os.vercel.app)
- **Database**: Supabase project `volrbqcolrqarmquaqvy` (us-west-2)

## Key architectural decisions

- **Auth:** Magic link only via Supabase Auth. NO Google OAuth. Uses PKCE flow (`@supabase/ssr` default). Magic link emails route to `/auth/confirm?token_hash=...&type=email`.
- **Admin role:** `eric@marcoullier.com` is hard-coded as the sole admin.
- **Team role:** Any member with `is_team = true` AND `kicked_out = false`. Same admin UI access as admin.
- **Member role:** Portal-only access (Phase 4).
- **Role check:** Implemented via `is_admin_or_team()` Postgres function (SECURITY DEFINER) used in RLS policies. Also checked in proxy and admin layout.
- **Data model philosophy:** Three distinct tables — `applications` (vetting events, persist forever), `members` (current-standing approved people), `tickets` (paid entry for a specific dinner). Plus `credits` and `dinners`.
- **No row deletions.** Soft-delete via `kicked_out` flag on members. Rejected applications stay in the applications table — that table IS the rejection/suppression list.
- **Demographics (gender, race, orientation) live on `applications` only.** Never copied to `members`.
- **One Ask per member.** `members.current_ask` is overwritten on save. Prefill logic: `ask_updated_at > last_dinner_attended`.
- **Multi-email members.** Members can have multiple email addresses via the `member_emails` table. Lookups (auth, ticket matching, application matching) check against ALL of a member's emails. Primary email = the email on the member's most recent approved application; this is what's used for outbound communication. Primary flips automatically when a new application is approved with a different email. Tickets do NOT change primary email (Stripe autofill is noisy).
  - TODO: When an application is approved with a different email than primary, flip primary to the application email (add to approve action in Phase 3).
  - TODO: When a ticket is fulfilled with an unrecognized email, insert a new `member_emails` row with `is_primary = false`, `source = 'ticket'` (add to fulfill action in Phase 3).

## Data model

Full schema in `supabase/migrations/20260415000000_initial_schema.sql` and `20260415100000_member_emails.sql`. Phase 2 schema additions (`email_status`, historical enum values) applied via `tmp/import.sql`.

- `dinners` — first-Thursday-of-month events, auto-generated 12 months out, skipping Jan/Jul. Date is UNIQUE.
- `applications` — vetting records with demographic data, status pending/approved/rejected, persist forever. `member_id` is NULL until approved.
- `members` — approved people, soft-deletable via `kicked_out`. `has_attended` is sticky (never flips back to false). `updated_at` auto-set by trigger.
- `tickets` — paid entry tied to a member + dinner, with fulfillment lifecycle (pending/fulfilled/refunded/credited). Tracks payment source and match confidence.
- `tickets` also supports historical imports: `payment_source = 'historical'`, `ticket_type = 'historical'`, `fulfillment_status = 'fulfilled'`, `amount_paid = 0`, no order ID, dinner date as both `purchased_at` and `fulfilled_at`.
- `credits` — outstanding/redeemed, tied to a source (refunded) ticket and optionally a redeemed ticket.
- `member_emails` — multiple emails per member. `is_primary` marks the canonical email. Partial unique index enforces at-most-one primary; constraint trigger enforces at-least-one. `source` tracks origin (application/ticket/manual). `email_status` is `'active'` (default) or `'bounced'`.

## Auth flow

1. User enters email at `/login`
2. Client calls `supabase.auth.signInWithOtp` with `emailRedirectTo` set to `${NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`
3. Supabase sends magic link email (PKCE flow)
4. User clicks link → Supabase template routes to `/auth/confirm?token_hash=...&type=email` on our app
5. `/auth/confirm` route calls `supabase.auth.verifyOtp({ token_hash, type })`, sets session cookies via `cookieStore`
6. Route checks admin/team status and redirects to `/admin` or `/portal`. Team lookup joins `members` to `member_emails` on `auth.jwt() ->> 'email'` (checks ALL of a member's emails, not a single `members.email` column — that column no longer exists).
7. Proxy (`src/proxy.ts`) refreshes session on every request and protects `/admin/*` routes — unauthenticated users go to `/login`, non-admin/non-team users go to `/portal`

**Gotcha:** `/auth/callback` (code exchange flow) also exists but the primary magic link flow uses `/auth/confirm` (token hash flow). Both are needed. The PKCE flow via `@supabase/ssr` generates email templates that use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.

## File structure

```
src/
├── proxy.ts                            # Session refresh + /admin route protection (Next.js 16 "proxy", replaces middleware.ts)
├── lib/supabase/
│   ├── client.ts                       # Browser client (createBrowserClient)
│   ├── server.ts                       # Server client (createServerClient with cookieStore)
│   └── admin.ts                        # Service role client (bypasses RLS)
├── app/
│   ├── page.tsx                        # Redirects to /login
│   ├── layout.tsx                      # Root layout (Geist fonts, Tailwind)
│   ├── login/page.tsx                  # Magic link sign-in form (client component)
│   ├── auth/
│   │   ├── confirm/route.ts            # PKCE token hash verification (primary magic link handler)
│   │   └── callback/route.ts           # Code exchange flow (secondary)
│   ├── portal/page.tsx                 # "Portal Coming Soon" placeholder
│   └── admin/
│       ├── layout.tsx                  # Auth check + role detection (server component)
│       ├── admin-shell.tsx             # Sidebar nav, header, sign-out (client component)
│       ├── page.tsx                    # Redirects to /admin/dinners
│       ├── dinners/
│       │   ├── page.tsx                # Dinner list with funnel columns (Applied/Approved/Paid/Intro-Ask); rows link to detail
│       │   └── [id]/page.tsx           # Dinner detail: tickets (with derived Intro/Ask status) + applications for that date
│       ├── applications/
│       │   ├── page.tsx                # Server wrapper
│       │   └── applications-table.tsx  # Filter tabs (pending/approved/rejected/all), click-to-detail
│       ├── members/
│       │   ├── page.tsx                # Server wrapper
│       │   └── members-table.tsx       # Search by name/email, click-to-detail
│       └── credits/
│           ├── page.tsx                # Server wrapper
│           └── credits-table.tsx       # Filter (outstanding/redeemed/all)
supabase/
├── migrations/
│   ├── 20260415000000_initial_schema.sql   # All tables, indexes, RLS, trigger, is_admin_or_team()
│   └── 20260415100000_member_emails.sql    # member_emails table, drops members.email, updates is_admin_or_team()
└── seed.sql                                # Original test data (replaced by Phase 2 import)
tmp/
├── import.sql                              # Generated Phase 2 import SQL (schema changes + all data)
├── import_summary.txt                      # Import counts and flags
└── import_validation.txt                   # Cross-check audit results
```

## Environment variables

Required in `.env.local` (see `.env.local.example` at repo root):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
- `NEXT_PUBLIC_SITE_URL` — App origin URL (`http://localhost:3000` for dev, `https://thunderview-os.vercel.app` for production)
- `RESEND_API_KEY` — TBD, not yet wired. Not yet in `.env.local.example`; add when Resend is integrated.

Production values are set in Vercel dashboard. Preview scope is missing anon key and service role key (Vercel CLI plugin bug — add manually in dashboard if needed).

## Supabase configuration (manual, not in code)

These are configured in the Supabase dashboard, not in the codebase:

- **Site URL:** `https://thunderview-os.vercel.app`
- **Redirect URLs allowlist:** `https://thunderview-os.vercel.app/**` and `http://localhost:3000/**`
- **SMTP:** Currently using Supabase's built-in dev SMTP (rate-limited, has injected unsubscribe footer). Pre-launch must-do: switch to Resend custom SMTP.
- **Email templates:** Customized via Management API. See "Email template requirements" below.
- **Magic link rate limits:** Default — 1 request per 60 seconds per email, hourly cap on built-in SMTP.

### Email template requirements

Magic link and signup confirmation email templates MUST use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` as the link target — NOT the default `{{ .ConfirmationURL }}`. The default generates a URL that verifies at Supabase's endpoint and redirects to the bare site root, which never establishes a session. The PKCE flow (used by `@supabase/ssr`) requires the token_hash format hitting our `/auth/confirm` route.

## What's done (Phase 1)

- Project scaffolded (Next.js 16, TypeScript, Tailwind CSS 4)
- Supabase clients: browser (`createBrowserClient`), server (`createServerClient` with cookies), admin (service role)
- Proxy (`src/proxy.ts`) for session refresh + `/admin` route protection
- Database schema: 6 tables (dinners, members, applications, tickets, credits, member_emails), indexes, `updated_at` trigger on members, primary-email constraint trigger on member_emails
- Multi-email support: `member_emails` table migration applied; `members.email` column dropped; `is_admin_or_team()` and "members can view own row" RLS policy rewritten to join through `member_emails`; admin pages (members, dinner detail, credits) read primary email via `member_emails`
- RLS enabled on all tables with `is_admin_or_team()` function (joins through `member_emails`) + "members can view own row" policy
- Magic link auth: login page, `/auth/confirm` (PKCE token hash), `/auth/callback` (code exchange), role-based redirect
- Supabase auth email templates updated to use PKCE token hash pattern (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`)
- Admin layout: sidebar nav, header with user email + Admin/Team badge, sign-out
- 4 admin pages, all READ-ONLY: dinner view (with tickets + applications), applications inbox (filter + detail), members list (search + detail), credits (filter)
- Admin dinners list funnel columns (Applied, Approved, Paid, Intro/Ask) with clickable rows linking to dinner detail
- Derived "Intro/Ask" ticket status on dinner detail page: shown when `fulfillment_status = 'fulfilled'` AND member has both `current_intro` and `current_ask` AND `ask_updated_at > last_dinner_attended` (or no prior attendance)
- Portal placeholder ("Portal Coming Soon")
- Seed data applied to Supabase (10 dinners, 5 members, 3 applications, 5 tickets, 1 credit — replaced by Phase 2 import)

## What's done (Phase 2)

- Data migration from Google Sheets, Squarespace Orders, Squarespace Contacts, and Streak CRM. 632 members, 825 member_emails, 706 applications, 1,253 historical tickets, 32 dinners imported. 0 credits (none in historical data).
- Schema additions applied inline via `tmp/import.sql`: `member_emails.email_status` column (`active`/`bounced`), `'historical'` added to `tickets.payment_source` and `tickets.ticket_type` CHECK constraints.
- Import audit passed: FK integrity, primary email uniqueness, has_attended/ticket consistency, marketing opt-out verification all clean.
- 65 bounced emails flagged via Squarespace cleaned export. 81 members opted out via Squarespace unsubscribed export.
- Import artifacts in `tmp/`: `import.sql` (generated SQL), `import_summary.txt`, `import_validation.txt`.

## What's NOT done

Phase 1 deliberately excluded these. Don't build them without an explicit prompt:

- Action buttons (approve/reject/fulfill/refund/credit) — Phase 3+
- Application form (will be hosted on Thunderview OS, not Squarespace) — Phase 3
- Attendee portal (intro/ask editor, profile, community directory) — Phase 4
- Email sending (Resend wiring) — Phase 3+
- Ticket purchase integration (Squarespace webhooks or Stripe) — Phase 5, blocked on Squarespace plan upgrade
- Bulk email templates — Phase 4
- Streak API integration — Phase 5
- CoachingOS sync — Phase 6

## Upcoming work

**Phase 3: Admin actions + application form + transactional emails (next up)**

Immediate priority is making the admin UI functional with CRUD actions:
- Approve/reject applications
- Fulfill/refund/credit tickets
- Edit members
- Application form (hosted on Thunderview OS, replacing Squarespace)
- Transactional emails via Resend (approval notifications, magic links with custom branding)

## Pre-launch checklist (before real users hit this)

- [ ] Switch Supabase SMTP from built-in to Resend
- [ ] Verify Thunderview sending domain in Resend (SPF, DKIM, DMARC)
- [ ] Customize magic link email template (subject, body, branding) — link format already fixed, but copy/styling still default
- [x] Verified all Supabase auth email templates use the `/auth/confirm?token_hash=...&type=email` pattern (not `{{ .ConfirmationURL }}`)
- [ ] Confirm From address is a Thunderview domain (no `noreply@mail.app.supabase.io`)
- [ ] Confirm injected unsubscribe footer is gone
- [ ] Set Vercel preview env vars (currently missing anon key + service role key in preview scope)

## Known issues / gotchas

- **PKCE flow uses `/auth/confirm`, not `/auth/callback`.** The `@supabase/ssr` package defaults to PKCE. Supabase's magic link email template generates URLs with `token_hash` query param pointing to `/auth/confirm`. The `/auth/callback` route (code exchange) also exists as a fallback. Both routes create their own `createServerClient` inline with direct `cookieStore` access — do not use the shared `lib/supabase/server.ts` helper in auth routes, as cookies won't propagate on redirects.
- **Next.js 16 uses `proxy.ts` instead of `middleware.ts`.** The file is `src/proxy.ts` with `export async function proxy(request)`. The `middleware` convention is deprecated.
- **Vercel preview env vars partially missing.** `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are not set for the preview environment due to a Vercel CLI plugin bug. Add manually in Vercel dashboard if branch deploys are needed.
- **Supabase built-in SMTP is rate-limited.** Magic link requests are capped at 1 per 60 seconds per email, with an hourly sending cap. Must switch to Resend before launch.
- **Supabase/PostgREST default row cap.** Supabase limits query results to 1,000 rows by default. This is silent — no error, just truncated results. Any query that might return more than 1,000 rows MUST explicitly set a higher limit or paginate. This has caused bugs across multiple projects. Always account for it.
