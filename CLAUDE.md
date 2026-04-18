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

The v4 handoff doc is the source of truth for product decisions. It lives outside the repo (in Eric's chat sessions) and Eric will paste relevant sections when needed. The handoff doc supersedes any conflicting comments or assumptions in the codebase.

## Stack

- **Next.js 16.2.3**, App Router, TypeScript
- **Tailwind CSS 4** (via `@tailwindcss/postcss`)
- **Supabase**: `@supabase/supabase-js` ^2.103.2, `@supabase/ssr` ^0.10.2
- **Resend** ^6.11.0 (installed, not yet wired)
- **Hosting**: Vercel (production: https://thunderview-os.vercel.app)
- **Database**: Supabase project `volrbqcolrqarmquaqvy` (us-west-2)

## Key architectural decisions

- **Auth:** Magic link only via Supabase Auth. NO Google OAuth. Uses PKCE flow (`@supabase/ssr` default). Magic link emails route to `/auth/confirm?token_hash=...&type=email`. All auth routes redirect to `/portal` — role-based routing happens on the portal page.
- **Admin role:** `eric@marcoullier.com` is hard-coded as the sole admin.
- **Team role:** Any member with `is_team = true` AND `kicked_out = false`. Same admin UI access as admin.
- **Member role:** Portal-only access (Phase 4).
- **Role check:** Implemented via `is_admin_or_team()` Postgres function (SECURITY DEFINER) used in RLS policies. Also checked in proxy and admin layout.
- **Data model philosophy:** Three distinct tables — `applications` (vetting events, persist forever), `members` (current-standing approved people), `tickets` (paid entry for a specific dinner). Plus `credits` and `dinners`.
- **No row deletions.** Soft-delete via `kicked_out` flag on members. Rejected applications stay in the applications table — that table IS the rejection/suppression list.
- **Demographics (gender, race, orientation) live on `applications` only.** Never copied to `members`.
- **One Ask per member.** `members.current_ask` is overwritten on save. Prefill logic: `ask_updated_at > last_dinner_attended`.
- **Multi-email members.** Members can have multiple email addresses via the `member_emails` table. Lookups (auth, ticket matching, application matching) check against ALL of a member's emails. Primary email = the email on the member's most recent approved application; this is what's used for outbound communication. Primary flips automatically when a new application is approved with a different email. Tickets do NOT change primary email (Stripe autofill is noisy).
  - ~~TODO: When an application is approved with a different email than primary, flip primary to the application email.~~ Done — `approve_application` and `link_application_to_member` RPCs handle this.
  - TODO: When a ticket is fulfilled with an unrecognized email, insert a new `member_emails` row with `is_primary = false`, `source = 'ticket'` (add to fulfill action in Phase 3).

## Data model

Full schema in `supabase/migrations/20260415000000_initial_schema.sql` and `20260415100000_member_emails.sql`. Phase 2 schema additions (`email_status`, historical enum values) applied via `tmp/import.sql`.

- `dinners` — first-Thursday-of-month events, auto-generated 12 months out, skipping Jan/Jul. Date is UNIQUE.
- `applications` — vetting records with demographic data, status pending/approved/rejected, persist forever. `first_name` + `last_name` (same split as members). `member_id` is NULL until approved.
- `members` — approved people, soft-deletable via `kicked_out`. `first_name` + `last_name` (split from single `name` column; backfilled by splitting on first space). Key trigger-managed columns:
  - `has_community_access` BOOLEAN (renamed from `has_attended`) — set to `true` on ticket INSERT. One-way by default; does not revert on refund/credit. A future revoke checkbox on the refund flow will allow manual revert (not yet built).
  - `first_dinner_attended` DATE — set on ticket INSERT to the dinner's date if currently null. On refund/credit, reverts to null only if `first_dinner_attended` matches the refunded ticket's dinner date; otherwise unchanged.
  - `last_dinner_attended` DATE — set on ticket fulfillment (`fulfillment_status` → `'fulfilled'`) to the dinner's date if later than the current value. On refund/credit, recalculated as MAX of remaining fulfilled tickets' dinner dates; null if none remain.
  - `marketing_opted_out_at` TIMESTAMPTZ — set to `now()` when `marketing_opted_in` flips to `false`, cleared to null when it flips back to `true`. Managed by trigger on UPDATE of `marketing_opted_in`.
  - `intro_updated_at` TIMESTAMPTZ — tracks when the member last updated their own Intro. Column exists but no trigger — set explicitly by portal save action (Phase 4). Admin edits do not update this timestamp.
  - `ask_updated_at` TIMESTAMPTZ — tracks when the member last updated their own Ask. No trigger — set explicitly by portal save action (Phase 4). Admin edits do not update this timestamp.
  - `updated_at` — auto-set by trigger.
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
6. Both `/auth/confirm` and `/auth/callback` always redirect to `/portal` after successful auth, regardless of role. Portal page checks role and shows admin button for admin/team.
7. Proxy (`src/proxy.ts`) refreshes session on every request, protects `/admin/*` routes (unauthenticated → `/login`, non-admin/non-team → `/portal`), and redirects authenticated users from `/login` to `/portal`

**Gotcha:** `/auth/callback` (code exchange flow) also exists but the primary magic link flow uses `/auth/confirm` (token hash flow). Both are needed. The PKCE flow via `@supabase/ssr` generates email templates that use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.

## File structure

```
src/
├── proxy.ts                            # Session refresh + /admin protection + /login redirect to /portal (Next.js 16 "proxy", replaces middleware.ts)
├── lib/supabase/
│   ├── client.ts                       # Browser client (createBrowserClient)
│   ├── server.ts                       # Server client (createServerClient with cookieStore)
│   └── admin.ts                        # Service role client (bypasses RLS)
├── app/
│   ├── page.tsx                        # Public marketing placeholder (Thunderview CEO Dinners)
│   ├── layout.tsx                      # Root layout (Geist fonts, Tailwind)
│   ├── login/page.tsx                  # Magic link sign-in form (client component)
│   ├── apply/
│   │   ├── page.tsx                    # Public application form (server wrapper: fetches dinners + schedule)
│   │   ├── application-form.tsx        # Client component: form fields, validation, submit
│   │   ├── actions.ts                  # Server action: submitApplication (inserts pending application)
│   │   └── thanks/
│   │       ├── page.tsx                # Thank-you page (static)
│   │       └── confetti.tsx            # Client component: canvas-confetti on page load
│   ├── auth/
│   │   ├── confirm/route.ts            # PKCE token hash verification (primary magic link handler)
│   │   └── callback/route.ts           # Code exchange flow (secondary)
│   ├── portal/
│   │   ├── page.tsx                    # Authenticated landing: auth check, role check, admin button for admin/team, sign out
│   │   └── sign-out-button.tsx         # Client component: sign-out button (inline, not shared with admin-shell)
│   └── admin/
│       ├── layout.tsx                  # Auth check + role detection (server component)
│       ├── admin-shell.tsx             # Sidebar nav, header, sign-out (client component)
│       ├── page.tsx                    # Dashboard: next-dinner stats, pending apps, unfulfilled tickets, opt-outs
│       ├── dashboard-accordions.tsx    # Client component: collapsible accordion sections
│       ├── dinners/
│       │   ├── page.tsx                # Server wrapper: fetches dinners + funnel stats
│       │   ├── dinners-table.tsx       # Client component: sortable columns, sticky header, rows link to detail
│       │   └── [id]/page.tsx           # Dinner detail: tickets (clickable to member) + approved-without-ticket list (clickable to app)
│       ├── applications/
│       │   ├── page.tsx                # Server wrapper
│       │   ├── applications-table.tsx  # Filter tabs, sortable columns, sticky header, rows link to [id]
│       │   └── [id]/
│       │       ├── page.tsx            # Server wrapper: fetches application
│       │       ├── application-detail.tsx  # Client component: detail layout, approve/reject/link actions
│       │       └── actions.ts          # Server actions: approveApplication, rejectApplication, linkApplicationToMember, searchMembers
│       ├── members/
│       │   ├── page.tsx                # Server wrapper: fetches members + upcoming dinners
│       │   ├── members-table.tsx       # Search, sortable columns, sticky header, kicked-out strikethrough, rows link to [id], Add Member button
│       │   ├── add-member-modal.tsx    # Add Member form modal (client component)
│       │   ├── actions.ts             # Server actions: checkEmail, addMember (for Add Member modal)
│       │   └── [id]/
│       │       ├── page.tsx            # Server wrapper: fetches member + determines admin role
│       │       ├── member-detail.tsx   # Client component: inline editing, toggles, email modal, remove/reinstate
│       │       └── actions.ts          # Server actions: updateMemberField, toggleMemberFlag, removeMember, reinstateMember, email management
│       └── credits/
│           ├── page.tsx                # Server wrapper
│           └── credits-table.tsx       # Filter, sortable columns, sticky header
├── lib/
│   └── format.ts                       # Shared display utilities (formatName, formatStageType, formatDate, formatTimestamp, getTodayMT, toDateMT)
supabase/
├── migrations/
│   ├── 20260415000000_initial_schema.sql   # All tables, indexes, RLS, trigger, is_admin_or_team()
│   ├── 20260415100000_member_emails.sql    # member_emails table, drops members.email, updates is_admin_or_team()
│   ├── 20260418000000_add_marketing_opted_out_at.sql  # marketing_opted_out_at column + trigger + backfill
│   ├── 20260418100000_schema_triggers_and_rename.sql  # first_dinner_attended, has_attended→has_community_access rename, ticket triggers
│   ├── 20260418200000_add_intro_updated_at.sql       # intro_updated_at column (trigger removed — set explicitly by portal)
│   ├── 20260418300000_add_member_rpc.sql             # add_member_with_application RPC (Add Member modal)
│   ├── 20260418400000_swap_primary_email_rpc.sql     # swap_primary_email RPC (atomic primary flip)
│   ├── 20260418500000_approve_application_rpc.sql    # approve_application RPC v1 (superseded by v2)
│   ├── 20260418600000_approve_v2_and_link_member_rpcs.sql  # approve_application v2 (kicked-out guard, primary flip) + link_application_to_member RPC
│   ├── 20260418700000_split_name_columns.sql              # Split name → first_name + last_name on members + applications, backfill, drop name
│   └── 20260418800000_update_rpcs_for_name_split.sql      # Update add_member_with_application, approve_application, link_application_to_member RPCs for first_name/last_name
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
- Import audit passed: FK integrity, primary email uniqueness, has_community_access/ticket consistency, marketing opt-out verification all clean.
- 65 bounced emails flagged via Squarespace cleaned export. 81 members opted out via Squarespace unsubscribed export.
- Import artifacts in `tmp/`: `import.sql` (generated SQL), `import_summary.txt`, `import_validation.txt`.

## What's done (Phase 3, in progress)

- Admin dashboard home page (`/admin`): next-dinner stats (date, days until, new apps, tickets sold), collapsible accordion sections (pending applications, unfulfilled tickets needing action, marketing opt-outs). Unfulfilled tickets queue only shows `fulfillment_status = 'pending'` — refunded and credited tickets are excluded.
- Schema: `marketing_opted_out_at` TIMESTAMPTZ on members, with trigger on `marketing_opted_in` changes; backfilled 85 existing opt-outs
- Schema: `first_dinner_attended` DATE on members; backfilled from earliest non-refunded/credited ticket
- Schema: renamed `has_attended` → `has_community_access` (all code references updated)
- Triggers on tickets: `trg_ticket_insert` (sets `has_community_access = true` on member, sets `first_dinner_attended` to dinner date if null), `trg_ticket_fulfillment_change` (on fulfill: sets `last_dinner_attended` if later than current; on refund/credit: recalculates `last_dinner_attended` as MAX of remaining fulfilled, reverts `first_dinner_attended` to null if it matched the refunded dinner)
- Dinner detail: "Approved Without Ticket" list replaces raw applications list. Before dinner date: approved apps whose member has no ticket for this dinner. After dinner date: approved apps whose member had no ticket purchased on or before the dinner date. Ticket rows link to member detail; application rows link to application detail.
- All list pages: sortable columns (click header to toggle asc/desc), sticky headers
- Members list: removed `kicked_out` and `is_team` columns; kicked-out members shown with full-row strikethrough
- Member detail page (`/admin/members/[id]`): server wrapper + client component. `<name> at <company>` heading with strikethrough for kicked-out (no pills — Team and Marketing Opt-Out are now toggles in column two). Column one: all fields editable inline — edit mode triggered by pencil icon on hover (all fields) or click-on-value (non-URL fields only). LinkedIn and Website remain clickable links; pencil icon is the only way to edit them. Editable fields: Name, Company, Type (dropdown), LinkedIn, Website, Intro (textarea), Ask (textarea), Contact Preference (dropdown). Email Addresses section: pencil icon (hover-only) or clicking any email opens the email management modal. Modal supports: add email (with duplicate validation against member_emails and applications), delete email (blocks last email), set primary (via `swap_primary_email` RPC). New emails: `source = 'manual'`. Column two: Application Date (earliest approved), Dinners list, Marketing Opted In toggle (immediate save, triggers `marketing_opted_out_at`), Team toggle (immediate save, admin-only — team members see label), Remove/Reinstate button with confirmation modal. Remove sets `kicked_out = true` + `marketing_opted_in = false`. Reinstate sets `kicked_out = false` + `marketing_opted_in = true`.
- Add Member modal on members list page: creates member + member_emails + approved application atomically via `add_member_with_application` RPC. Form: Name, Email, Company, Website, LinkedIn, Type, Gender/Race/Orientation dropdowns (default "Prefer not to say"), Preferred Dinner Date. Email validation checks member_emails and applications for duplicates. Success shows "[name] added!" modal.
- Application detail page (`/admin/applications/[id]`): server wrapper + client component. `<name> at <company>` heading with status pill (yellow pending, green approved, red rejected). "View member →" link when `member_id` exists. Approve button (shown when pending or rejected): `approve_application` RPC creates member + member_emails + updates application in single transaction. If email matches existing member, links without creating duplicate (re-application path) and flips primary email to application email. If existing member is kicked out, blocks with red warning + link to member page. Rejected-to-approved flip supported (clears rejection reason). Reject button (shown when pending): modal with reason dropdown ("Service Provider", "services business", "Other" with freeform input). "Link to existing member" button (shown when pending, no member_id): opens member search modal, links application to selected member via `link_application_to_member` RPC, adds/flips primary email. Blocked if selected member is kicked out. Email TODOs differentiated: template #1 for new member approval, template #2 for re-application/linked existing. Two-column layout unchanged.
- Detail pages are standalone routes, not inline modals. Table rows use `Link` to navigate to `/admin/members/[id]` or `/admin/applications/[id]`. Browser back button works correctly.
- Schema: `intro_updated_at` TIMESTAMPTZ on members. No trigger — will be set explicitly by portal save action (Phase 4). Admin edits do not update this timestamp. No backfill — existing rows null.
- Timezone standardization: all date display and comparison logic uses America/Denver. Shared utilities in `src/lib/format.ts`: `formatDate()` (DATE or TIMESTAMPTZ → display string in MT), `formatTimestamp()` (TIMESTAMPTZ → display with time in MT), `getTodayMT()` (today as YYYY-MM-DD in MT), `toDateMT()` (TIMESTAMPTZ → YYYY-MM-DD in MT for comparisons). No raw `toLocaleDateString()` or `toISOString().slice()` calls remain in the codebase. Stored data is unchanged (TIMESTAMPTZ is UTC internally, DATE columns are timezone-agnostic).
- Display name cleanup: `formatStageType()` in `src/lib/format.ts` — "Active CEO (Bootstrapping or VC-Backed)" → "Active CEO", "Exited CEO (Acquisition or IPO)" → "Exited CEO"
- Members search input text color fixed (was invisible against background)

## What's NOT done

Don't build these without an explicit prompt:

- Action buttons: fulfill/refund/credit tickets — Phase 3+
- `has_community_access` revoke checkbox on refund flow — allows manual revert to `false` when refunding a ticket (Phase 3+)
- Application form (will be hosted on Thunderview OS, not Squarespace) — Phase 3
- Attendee portal (intro/ask editor, profile, community directory) — Phase 4. Portal save action must explicitly set `intro_updated_at = now()` and `ask_updated_at = now()` when the member updates their own Intro or Ask.
- Email sending (Resend wiring) — Phase 3+. TODOs in approve/reject actions mark where emails should fire. Template #1: new member approval ("you're approved, buy a ticket"). Template #2: re-application/linked ("you're already in, just buy a ticket next time"). Template #3: rejection.
- Ticket purchase integration (Squarespace webhooks or Stripe) — Phase 5, blocked on Squarespace plan upgrade
- Bulk email templates — Phase 4
- Streak API integration — Phase 5
- CoachingOS sync — Phase 6
- LinkedIn URL matching for automatic duplicate detection across applications and members
- Side-by-side comparison when re-application has different data than existing member record (name, company, website changes)
- Automatic member field updates from re-application data

## Upcoming work

**Phase 3: Admin actions + application form + transactional emails (next up)**

Remaining Phase 3 work:
- Fulfill/refund/credit tickets
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
