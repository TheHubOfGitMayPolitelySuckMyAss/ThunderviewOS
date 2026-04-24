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
- **Stripe**: `stripe` ^22.0.2 (Checkout Sessions + refunds, sandbox mode)
- **Resend** ^6.11.0 (all transactional emails wired)
- **lucide-react** (all icons — no emoji, no unicode arrows)
- **Hosting**: Vercel (production: https://thunderview-os.vercel.app)
- **Database**: Supabase project `volrbqcolrqarmquaqvy` (us-west-2)
- **Design system**: `design-system/` directory at repo root. `README.md` is the visual spec (positioning, content rules, visual foundations, layout invariants, iconography). `colors_and_type.css` is the token source. `ui_kits/` has HTML prototypes (marketing, portal, admin, emails). See "Design system" section below.

## Key architectural decisions

- **Auth:** Magic link only via Supabase Auth. NO Google OAuth. Uses PKCE flow (`@supabase/ssr` default). Magic link emails route to `/auth/confirm?token_hash=...&type=email`. All auth routes redirect to `/portal` — role-based routing happens on the portal page.
- **Admin role:** `eric@marcoullier.com` is hard-coded as the sole admin.
- **Team role:** Any member with `is_team = true` AND `kicked_out = false`. Same admin UI access as admin.
- **Member role:** Portal-only access (Phase 4).
- **Role check:** Implemented via `is_admin_or_team()` Postgres function (SECURITY DEFINER) used in RLS policies. Also checked in proxy and admin layout.
- **Data model philosophy:** Three distinct tables — `applications` (vetting events, persist forever), `members` (current-standing approved people), `tickets` (paid entry for a specific dinner). Plus `credits` and `dinners`.
- **No row deletions.** Soft-delete via `kicked_out` flag on members. Rejected applications stay in the applications table — that table IS the rejection/suppression list.
- **Demographics (gender, race, orientation) live on `applications` only.** Never copied to `members`.
- **One Ask per member.** `members.current_ask` is overwritten on save. Prefill logic: `ask_updated_at > last_dinner_attended`. Character limits: intro 1,000, ask 250. Enforced client-side (`maxLength`) and server-side (portal save action). DB columns are unconstrained TEXT.
- **Multi-email members.** Members can have multiple email addresses via the `member_emails` table. Lookups (auth, ticket matching, application matching) check against ALL of a member's emails. Primary email = the email on the member's most recent approved application; this is what's used for outbound communication. Primary flips automatically when a new application is approved with a different email. Tickets do NOT change primary email (Stripe autofill is noisy).
  - ~~TODO: When an application is approved with a different email than primary, flip primary to the application email.~~ Done — `approve_application` and `link_application_to_member` RPCs handle this.
  - TODO: When a ticket is fulfilled with an unrecognized email, insert a new `member_emails` row with `is_primary = false`, `source = 'ticket'` (add to fulfill action in Phase 3).

## Data model

Full schema in `supabase/migrations/20260415000000_initial_schema.sql` and `20260415100000_member_emails.sql`. Phase 2 schema additions (`email_status`, historical enum values) applied via `tmp/import.sql`.

- `dinners` — first-Thursday-of-month events, auto-generated 12 months out via Vercel Cron (`/api/cron/generate-dinner`), skipping Jan/Jul. Date is UNIQUE. Cron fires daily at 1pm UTC; handler runs only on the day after the first Thursday of each month. `venue` TEXT NOT NULL DEFAULT `'ID345'`, `address` TEXT NOT NULL DEFAULT `'3960 High St, Denver, CO 80205'` — both inline-editable on dinner detail page.
- `applications` — vetting records with demographic data, status pending/approved/rejected, persist forever. `first_name` + `last_name` (same split as members). `member_id` is NULL until approved.
- `members` — approved people, soft-deletable via `kicked_out`. `first_name` + `last_name` (split from single `name` column; backfilled by splitting on first space). `attendee_stagetypes` is `TEXT[]` (not null, default `'{}'`) — supports multi-role membership (e.g. Active CEO + Investor). Note: `applications.attendee_stagetype` remains a single TEXT column; the application form is single-select. Key trigger-managed columns:
  - `has_community_access` BOOLEAN — set to `true` on member creation (all three RPCs: `approve_application`, `add_member_with_application`, `link_application_to_member`) AND on ticket INSERT (trigger). Being an approved member = community access. Set to `false` on UPDATE when `kicked_out` flips false→true (trigger `trg_revoke_community_access_on_kickout`). Does NOT auto-restore on un-kick or on refund/credit. A future revoke checkbox on the refund flow will allow manual revert (not yet built).
  - `first_dinner_attended` DATE — set on ticket INSERT to the dinner's date if currently null. On refund/credit, reverts to null only if `first_dinner_attended` matches the refunded ticket's dinner date; otherwise unchanged.
  - `last_dinner_attended` DATE — set by `post-dinner` cron (fires daily, checks if yesterday was a dinner, updates all members with fulfilled tickets for that dinner). NOT set by the fulfillment trigger (removed — fulfillment can happen for future dinners, which would incorrectly advance this date). On refund/credit, recalculated as MAX of remaining fulfilled tickets for past dinners; null if none remain.
  - `marketing_opted_out_at` TIMESTAMPTZ — set to `now()` when `marketing_opted_in` flips to `false`, cleared to null when it flips back to `true`. Managed by trigger on UPDATE of `marketing_opted_in`.
  - `intro_updated_at` TIMESTAMPTZ — tracks when the member last updated their own Intro. Column exists but no trigger — set explicitly by portal save action (Phase 4). Admin edits do not update this timestamp.
  - `ask_updated_at` TIMESTAMPTZ — tracks when the member last updated their own Ask. No trigger — set explicitly by portal save action (Phase 4). Admin edits do not update this timestamp.
  - `profile_pic_url` TEXT NULL — full public URL to profile pic in Supabase Storage bucket `profile-pics`. Null = no pic. Set by portal profile save action.
  - `updated_at` — auto-set by trigger.
- `tickets` — paid entry tied to a member + dinner, with fulfillment lifecycle (purchased/fulfilled/refunded/credited). Tracks payment source and match confidence. `fulfillment_status = 'fulfilled'` means "dinner-details email has been sent." It does NOT mean "attended." Attendance is not tracked. The only reason fulfilled exists is to gate the fulfillment email. All paid tickets for future-beyond-next dinners stay `purchased` until ~27 days before their dinner, when a cron flips them and sends the email (Phase 5, not yet built). Tickets for the next upcoming dinner auto-fulfill immediately on purchase. The webhook and comp ticket action only flip to fulfilled if `dinner_id` matches `getTargetDinner()`.
- `tickets` also supports historical imports: `payment_source = 'historical'`, `ticket_type = 'historical'`, `fulfillment_status = 'fulfilled'`, `amount_paid = 0`, no order ID, dinner date as both `purchased_at` and `fulfilled_at`.
- `credits` — outstanding/redeemed, tied to a source (refunded) ticket and optionally a redeemed ticket.
- `member_emails` — multiple emails per member. `is_primary` marks the canonical email. Partial unique index enforces at-most-one primary; constraint trigger enforces at-least-one. `source` tracks origin (application/ticket/manual). `email_status` is `'active'` (default) or `'bounced'`.
- `email_templates` — editable email templates. `slug` (unique, e.g. `'approval'`), `subject`, `body` (with `[member.fieldname]` variable placeholders), `updated_at` (trigger-managed), `updated_by` (FK to members). RLS: admin/team read + update.

## Auth flow

1. User enters email at `/login`
2. Client calls `supabase.auth.signInWithOtp` with `shouldCreateUser: false` and `emailRedirectTo` set to `${NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`
3. Supabase sends magic link email (PKCE flow). If the email is not in `auth.users`, the call succeeds silently but no email is sent (prevents orphan auth rows for unknown emails)
4. User clicks link → Supabase template routes to `/auth/confirm?token_hash=...&type=email` on our app
5. `/auth/confirm` route calls `supabase.auth.verifyOtp({ token_hash, type })`, sets session cookies via `cookieStore`
6. Both `/auth/confirm` and `/auth/callback` always redirect to `/portal` after successful auth, regardless of role. Portal page checks role and shows admin button for admin/team.
7. Proxy (`src/proxy.ts`) refreshes session on every request, protects `/admin/*` routes (unauthenticated → `/login`, non-admin/non-team → `/portal`), protects `/portal/*` routes (unauthenticated → `/login`, non-admin without `has_community_access = true` → `/`), and redirects authenticated users from `/login` to `/portal`. Since kick-out revokes `has_community_access` via trigger, no separate `kicked_out` check is needed in the portal guard.

**Gotcha:** `/auth/callback` (code exchange flow) also exists but the primary magic link flow uses `/auth/confirm` (token hash flow). Both are needed. The PKCE flow via `@supabase/ssr` generates email templates that use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.

## File structure

```
src/
├── proxy.ts                            # Session refresh + /admin protection + /portal protection + /login redirect (Next.js 16 "proxy", replaces middleware.ts)
├── components/
│   ├── top-nav.tsx                     # Authenticated top nav (portal + admin): Fraunces logo, center links, avatar dropdown. Uses .tv-nav (64px height)
│   ├── public-nav.tsx                  # Public marketing nav: logo, center links (About/FAQ/Team/Gallery), Apply + Sign In (or Portal when authenticated). Server component with auth check
│   ├── member-avatar.tsx              # Reusable avatar: shows profile pic if set, clay-500 initials circle if not. Props: member (first_name, last_name, profile_pic_url), size (sm/md/lg)
│   ├── page-header.tsx                # Shared page header: eyebrow/title/lede/actions with locked rhythm. size="default" (tv-h1, 64px gap) or "compact" (tv-h3, 24px gap). Portal pages don't use this yet — see "Known gap" section
│   ├── field.tsx                       # Shared form field wrapper: label/required/help/error/children. flex-col with gap-label-input (8px). Error and help mutually exclusive
│   └── ui/                            # Design system primitives (compose these, don't inline)
│       ├── index.ts                   # Barrel export
│       ├── button.tsx                 # Primary/secondary/ghost, sm/md/lg, asChild prop for wrapping Links
│       ├── card.tsx                   # Default/elevated/feature (shadow-glow)/photo variants
│       ├── pill.tsx                   # Stage/neutral/accent/success/warn/danger with optional dot
│       ├── avatar.tsx                 # Re-export of member-avatar.tsx
│       ├── input.tsx                  # Warm focus ring, error state, inset active shadow
│       ├── textarea.tsx               # Same treatment as input
│       ├── select.tsx                 # Custom chevron, same treatment
│       ├── label.tsx                  # 13px medium, optional required asterisk
│       ├── field-help.tsx             # Hint text, error variant
│       └── typography.tsx             # Eyebrow, H1–H4, Lede, Body, Small — thin wrappers around .tv-* classes
├── lib/supabase/
│   ├── client.ts                       # Browser client (createBrowserClient)
│   ├── server.ts                       # Server client (createServerClient with cookieStore)
│   └── admin.ts                        # Service role client (bypasses RLS)
├── app/
│   ├── page.tsx                        # Marketing home: hero + stats + three-reason grid + quote + gallery + CTA. Conditional: anonymous → "Apply To Join", authenticated → "Buy A Dinner Ticket"
│   ├── layout.tsx                      # Root layout (Inter + Fraunces + JetBrains Mono via next/font/google, Tailwind)
│   ├── about/page.tsx                  # Placeholder (public-nav + H1)
│   ├── faq/page.tsx                    # Placeholder (public-nav + H1)
│   ├── team/page.tsx                   # Placeholder (public-nav + H1)
│   ├── gallery/page.tsx                # Placeholder (public-nav + H1)
│   ├── login/page.tsx                  # Magic link sign-in: server wrapper with PublicNav
│   ├── login/login-form.tsx            # Client component: email input, send magic link, success/error states
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
│   │   ├── layout.tsx                  # Portal layout: auth check, TopNav, wraps all /portal/* pages
│   │   ├── page.tsx                    # Two-column portal home: nav buttons (left) + inline Intro/Ask/Contact form (right)
│   │   ├── portal-form.tsx             # Client component: Intro/Ask textareas, Contact dropdown, Save with toast. Ticket banner with glow shadow
│   │   ├── purchase-confetti.tsx       # Client component: fires confetti on ?purchased=true, cleans up param
│   │   ├── actions.ts                  # Server action: savePortalProfile (updates intro/ask/contact, sets timestamps only on change)
│   │   ├── sign-out-button.tsx         # Client component: sign-out button (unused — sign-out now in TopNav dropdown)
│   │   ├── profile/
│   │   │   ├── page.tsx                # Profile editor: all member fields + intro/ask/contact + primary email
│   │   │   ├── profile-form.tsx        # Client component: profile form with multi-select stagetypes, email, toast
│   │   │   └── actions.ts             # Server action: saveProfile (member fields + email swap/insert + timestamps)
│   │   ├── community/
│   │   │   ├── page.tsx                # Community directory: fetchAll paginated, filtered (has_community_access + not kicked_out)
│   │   │   └── community-table.tsx     # Client component: searchable, sortable table (Name/Company/Role), rows link to /portal/members/[id]
│   │   ├── members/
│   │   │   └── [id]/page.tsx           # Read-only member profile: details + intro/ask. 404 if kicked_out or no community access. Self-view shows Edit Profile button
│   │   ├── recap/page.tsx              # Last month's recap: fulfilled attendees of most recent past dinner with intro/ask cards
│   │   └── tickets/
│   │       ├── page.tsx                # Ticket selection: dinner dropdown + buy buttons (server component)
│   │       ├── ticket-purchase.tsx     # Client component: dinner dropdown, guest-aware buy buttons, calls purchaseTicket action
│   │       ├── guest/page.tsx          # Legacy guest upsell page (orphaned — no longer navigated to)
│   │       └── cart/
│   │           ├── page.tsx            # Legacy cart page (orphaned — no longer navigated to)
│   │           ├── actions.ts          # Server action: purchaseTicket (creates Stripe Checkout Session, redirects to Stripe). Success URL → /portal?purchased=true
│   │           └── purchase-button.tsx # Legacy purchase button (orphaned — no longer navigated to)
│   ├── api/cron/generate-dinner/
│   │   └── route.ts                    # Vercel Cron: auto-generate dinner 12 months out (daily fire, day-after-first-Thursday logic)
│   ├── api/cron/post-dinner/
│   │   └── route.ts                    # Vercel Cron: day after each dinner, sets last_dinner_attended for all fulfilled attendees
│   ├── api/cron/fulfill-tickets/
│   │   └── route.ts                    # Vercel Cron: 27 days before each dinner, flips purchased→fulfilled + sends fulfillment email
│   ├── api/cron/morning-of/
│   │   └── route.ts                    # Vercel Cron: morning of dinner (7am MT), sends morning-of email to all fulfilled attendees
│   ├── api/webhooks/stripe/
│   │   └── route.ts                    # Stripe webhook: checkout.session.completed → insert ticket (purchased), auto-fulfill if next dinner
│   ├── dev/
│   │   ├── ui/page.tsx                # Dev-only UI primitive showcase (every component in every state)
│   │   └── emails/[slug]/page.tsx     # Dev-only email template preview with sample data (approval, re-application, rejection, fulfillment, morning-of, admin-notification)
│   └── admin/
│       ├── layout.tsx                  # Auth check + role detection + TopNav (server component)
│       ├── admin-shell.tsx             # Sidebar nav only (client component; header moved to TopNav)
│       ├── page.tsx                    # Dashboard: next-dinner stats, pending apps, opt-outs
│       ├── dashboard-accordions.tsx    # Client component: collapsible accordion sections (pending apps, opt-outs)
│       ├── dinners/
│       │   ├── page.tsx                # Server wrapper: fetches dinners + funnel stats
│       │   ├── dinners-table.tsx       # Client component: sortable columns, sticky header, rows link to detail
│       │   └── [id]/
│       │       ├── page.tsx            # Server wrapper: fetches dinner + tickets + applications
│       │       ├── dinner-tickets.tsx  # Client component: active ticket table with Credit/Refund buttons, inactive section with strikethrough
│       │       ├── dinner-venue.tsx   # Client component: inline-editable venue + address
│       │       └── actions.ts          # Server actions: refundTicket (full/guest_only), creditTicket, updateDinnerField
│       ├── applications/
│       │   ├── page.tsx                # Server wrapper
│       │   ├── applications-table.tsx  # Filter tabs, sortable columns, sticky header, rows link to [id]
│       │   └── [id]/
│       │       ├── page.tsx            # Server wrapper: fetches application
│       │       ├── application-detail.tsx  # Client component: detail layout, approve/reject/link actions
│       │       └── actions.ts          # Server actions: approveApplication, rejectApplication, linkApplicationToMember, searchMembers
│       ├── tickets/
│       │   ├── page.tsx                # Server wrapper: fetches all tickets (paginated past 1k cap)
│       │   └── tickets-table.tsx       # Client component: search, sortable columns, sticky header, rows link to dinner detail
│       ├── emails/
│       │   ├── page.tsx                # Email template nav: Marketing (Monday Before, Monday After) + Transactional (Approval, Re-application, Rejection, Fulfillment, Morning Of)
│       │   ├── template-editor.tsx     # Shared client component: subject/body editing, Send Test Email, Save Changes (used by all template pages)
│       │   ├── approval/
│       │   │   ├── page.tsx            # Server wrapper: fetches approval template
│       │   │   ├── template-editor.tsx # Thin wrapper passing actions + variables to shared editor
│       │   │   └── actions.ts          # Server actions: sendTestEmail ([member.firstname]), saveTemplate
│       │   ├── re-application/
│       │   │   ├── page.tsx            # Server wrapper: fetches re-application template
│       │   │   ├── template-editor.tsx # Thin wrapper
│       │   │   └── actions.ts          # Server actions: sendTestEmail ([member.firstname]), saveTemplate
│       │   ├── rejection/
│       │   │   ├── page.tsx            # Server wrapper: fetches rejection template
│       │   │   ├── template-editor.tsx # Thin wrapper
│       │   │   └── actions.ts          # Server actions: sendTestEmail ([applicant.firstname] from member record for test), saveTemplate
│       │   ├── fulfillment/
│       │   │   ├── page.tsx            # Server wrapper: fetches fulfillment template
│       │   │   ├── template-editor.tsx # Thin wrapper
│       │   │   └── actions.ts          # Server actions: sendTestEmail ([member.firstname], [dinner.date/venue/address] from next dinner), saveTemplate
│       │   └── morning-of/
│       │       ├── page.tsx            # Server wrapper: fetches template + next dinner attendees
│       │       ├── morning-of-editor.tsx # Client component: template editor + attendee preview cards + Preview Full Email button
│       │       └── actions.ts          # Server actions: sendTestEmail, sendPreviewEmail (saved template + live attendees), saveTemplate
│       ├── members/
│       │   ├── page.tsx                # Server wrapper: fetches members + upcoming dinners
│       │   ├── members-table.tsx       # Search, sortable columns, sticky header, kicked-out strikethrough, rows link to [id], Add Member button
│       │   ├── add-member-modal.tsx    # Add Member form modal (client component)
│       │   ├── actions.ts             # Server actions: checkEmail, addMember (for Add Member modal)
│       │   └── [id]/
│       │       ├── page.tsx            # Server wrapper: fetches member + determines admin role
│       │       ├── member-detail.tsx   # Client component: inline editing, toggles, email modal, remove/reinstate
│       │       └── actions.ts          # Server actions: updateMemberField, toggleMemberFlag, removeMember, reinstateMember, email management
├── lib/
│   ├── email.ts                        # EMAIL_FROM ("Thunderview Team <team@...>"), bodyToHtml() (branded HTML shell with optional appendHtml for morning-of attendees), helper functions (emailCtaButton, emailSignature, emailDetailsTable)
│   ├── email-send.ts                   # Transactional email senders (approval, re-application, rejection, fulfillment, morning-of, admin notification). All use bodyToHtml() for branded shell
│   ├── format.ts                       # Shared display utilities (formatName, formatStageType, formatDate, formatTimestamp, formatDinnerDisplay, formatTicketName, getTodayMT, toDateMT, firstThursdayOf)
│   ├── ticket-assignment.ts            # Target dinner logic (getTargetDinner → next upcoming dinner) + ticket type/price mapping (getTicketInfo)
│   └── ticket-rules.ts                # Predicate: allowsGuestTicket(dinner) — checks dinner.guests_allowed flag
public/
├── brand/
│   ├── photos/                         # 12 candid dinner photos (webp) — used on marketing home + recap
│   └── logo/
│       ├── wordmark.svg               # SVG wordmark (needs CSS classes to render text — use text logo in nav instead)
│       └── monogram.svg               # SVG monogram mark
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
│   ├── 20260418800000_update_rpcs_for_name_split.sql      # Update add_member_with_application, approve_application, link_application_to_member RPCs for first_name/last_name
│   ├── 20260418900000_portal_tickets.sql                  # Add quantity column to tickets, add 'portal' to payment_source CHECK
│   ├── 20260419000000_phase4_stagetypes_and_kickout.sql   # members.attendee_stagetype → attendee_stagetypes TEXT[]; RPCs write array; kick-out revokes has_community_access trigger
│   ├── 20260420000000_profile_pic.sql                    # Add profile_pic_url TEXT NULL to members
│   ├── 20260420100000_stripe_columns.sql                # Add stripe_session_id, stripe_payment_intent_id to tickets (partial unique index)
│   ├── 20260420200000_stripe_refund_id.sql              # Add stripe_refund_id TEXT NULL to tickets
│   ├── 20260420300000_guests_allowed.sql                # Add dinners.guests_allowed BOOLEAN NOT NULL DEFAULT false; backfill December → true
│   ├── 20260420400000_comp_payment_source.sql           # Add 'comp' to tickets.payment_source CHECK constraint
│   ├── 20260420500000_nullable_preferred_dinner_date.sql # Allow NULL on applications.preferred_dinner_date
│   ├── 20260420600000_rename_pending_to_purchased.sql   # Rename fulfillment_status 'pending' → 'purchased'; backfill all rows
│   ├── 20260420700000_email_templates.sql               # email_templates table + RLS + approval template seed
│   ├── 20260420800000_dinner_venue_address.sql          # Add address column, update venue default to 'ID345', backfill future dinners
│   ├── 20260420900000_post_dinner_cron_and_trigger_fix.sql  # Remove last_dinner_attended from fulfillment trigger; now set by post-dinner cron
│   ├── 20260421000000_morning_of_sent_at.sql                # dinners.morning_of_sent_at column for morning-of cron idempotency
│   └── 20260421100000_fix_has_community_access_on_approval.sql  # Backfill has_community_access = true for 161 existing members
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
- `NEXT_PUBLIC_SITE_URL` — App origin URL (`http://localhost:3000` for dev, `https://thunderview-os.vercel.app` for production). **Gotcha:** always `.trim()` when reading — a trailing newline in Vercel env vars broke Stripe URLs in Sprint 8.
- `STRIPE_SECRET_KEY` — Stripe sandbox secret key (`sk_test_...`). Server-side only.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe sandbox publishable key (`pk_test_...`). Currently unused client-side (Checkout is redirect-based, not embedded).
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret. For local dev: comes from `stripe listen` output. For production: from the registered webhook endpoint (`we_1TOKwXBZUujGbd3L93xKwlDl`).
- `RESEND_API_KEY` — Resend API key for transactional and marketing emails. Set in Vercel (Production + Preview scopes) and `.env.local`.

Production values are set in Vercel dashboard (Production + Development scopes). **Note:** Stripe sandbox keys are in both Production and Development scopes — no live keys yet. A future sprint will swap Production to live-mode keys.

## Supabase configuration (manual, not in code)

These are configured in the Supabase dashboard, not in the codebase:

- **Site URL:** `https://thunderview-os.vercel.app`
- **Redirect URLs allowlist:** `https://thunderview-os.vercel.app/**` and `http://localhost:3000/**`
- **SMTP:** Resend custom SMTP (`team@thunderviewceodinners.com`). Switched from built-in SMTP in Sprint 13. Rate limit: 30/hour (adjustable in Supabase dashboard).
- **Email templates:** Customized via Management API. See "Email template requirements" below.
- **Magic link rate limits:** Default — 1 request per 60 seconds per email.

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
- 4 admin pages, all READ-ONLY: dinner view (with tickets + applications), applications inbox (filter + detail), members list (search + detail), credits (filter — later removed in Phase 3)
- Admin dinners list columns (Paid, Intro/Ask, Guests) with clickable rows linking to dinner detail. Paid = sum of quantity where `fulfillment_status IN ('purchased', 'fulfilled')` — includes purchased-but-not-yet-fulfilled future-dinner tickets. Applied/Approved columns removed in Sprint 11.
- Derived "Intro/Ask" ticket status on dinner detail page: shown ONLY on the next upcoming dinner, when `fulfillment_status = 'fulfilled'` AND member has both `current_intro` and `current_ask` AND `ask_updated_at > last_dinner_attended` (or no prior attendance). All other dinners show "Fulfilled" for fulfilled tickets.
- Portal placeholder ("Portal Coming Soon")
- Seed data applied to Supabase (10 dinners, 5 members, 3 applications, 5 tickets, 1 credit — replaced by Phase 2 import)

## What's done (Phase 2)

- Data migration from Google Sheets, Squarespace Orders, Squarespace Contacts, and Streak CRM. 632 members, 825 member_emails, 706 applications, 1,253 historical tickets, 32 dinners imported. 0 credits (none in historical data).
- Schema additions applied inline via `tmp/import.sql`: `member_emails.email_status` column (`active`/`bounced`), `'historical'` added to `tickets.payment_source` and `tickets.ticket_type` CHECK constraints.
- Import audit passed: FK integrity, primary email uniqueness, has_community_access/ticket consistency, marketing opt-out verification all clean.
- 65 bounced emails flagged via Squarespace cleaned export. 81 members opted out via Squarespace unsubscribed export.
- Import artifacts in `tmp/`: `import.sql` (generated SQL), `import_summary.txt`, `import_validation.txt`.

## What's done (Phase 3, in progress)

- Admin dashboard home page (`/admin`): next-dinner stats (date, days until, new apps, tickets sold), collapsible accordion sections (pending applications, marketing opt-outs).
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
- Portal ticket purchase flow (`/portal/tickets`): authenticated members pick a dinner from a dropdown (most recent past dinner + next 3 upcoming, filtered to exclude dinners member already has a purchased/fulfilled ticket for). Ticket type and price derived from member's `attendee_stagetypes` (Active/Exited CEO → $40, Investor → $100, Guest → $40). For non-guests-allowed dinners: single "Buy Ticket" button. For guests-allowed dinners: two side-by-side buttons ("Buy Ticket" and "Buy Ticket + Guest", +$40). No intermediate guest/cart pages — click goes directly to Stripe Checkout. Single ticket row with `quantity` column (1 or 2). `payment_source = 'portal'`. Guest eligibility determined by `dinner.guests_allowed` flag via `allowsGuestTicket()` predicate, not by month. Edge cases: existing purchased/fulfilled ticket for a dinner → that dinner filtered from dropdown; kicked out → redirect to portal; no stagetype → contact Eric message; no available dinners → error message.
- Schema: `quantity` INTEGER NOT NULL DEFAULT 1 on tickets. `payment_source` CHECK updated to include `'portal'`.
- Proxy updated: `/portal/*` routes now redirect unauthenticated users to `/login`.
- Portal page: "Buy Your Ticket" button shown for non-kicked-out members.
- Admin display: dinner detail and dinners list sum `quantity` for attendee counts (not row count). Ticket rows with `quantity > 1` display as "Name +1". Shared helper `formatTicketName()` in `src/lib/format.ts`.
- Dashboard: removed "Unfulfilled Tickets" accordion (no longer needed with portal ticket flow). Only pending applications and marketing opt-outs remain.
- Dinner detail redesigned: active tickets table (purchased/fulfilled) with Credit and Refund action buttons per row; Type and Amount columns removed. Refunded/credited tickets shown in a separate bottom section with full-row strikethrough and status pills. Refund-only (no Credit) for qty=2 tickets.
- Refund flow: calls `stripe.refunds.create()` before flipping DB status (skips Stripe for historical tickets or tickets without `stripe_payment_intent_id`). qty=1 full refund sets `fulfillment_status = 'refunded'`, existing triggers recalculate dates. qty=2 offers "Refund Guest Only" ($40 refund, decrements quantity to 1, reduces amount_paid by $40, keeps status) or "Refund Both" (full refund, sets status to refunded). `stripe_refund_id` stored on ticket. Portal tickets missing `stripe_payment_intent_id` flagged as data anomaly. Comp tickets (`payment_source = 'comp'`) hide Credit/Refund buttons. Confirmation modal for all refunds; Stripe errors surface inline in the modal.
- Credit flow: sets ticket `fulfillment_status = 'credited'`, creates a `credits` row with `source_ticket_id` and `status = 'outstanding'`. Confirmation modal.
- Apply Credit on member detail page: "Apply Credit" button shown at top of column two when member has unredeemed credits (`credits.status = 'outstanding'` AND `redeemed_ticket_id IS NULL`). On confirm: computes target dinner via `getTargetDinner()`, inserts ticket as purchased then updates to fulfilled (fires both insert and fulfillment triggers), sets `payment_source = 'credit'`, `amount_paid = 0`, marks oldest unredeemed credit as redeemed. Button stays visible if multiple credits remain.
- Kicked-out member exclusion from dinner views: approved applications whose linked member has `kicked_out = true` are excluded from dinner funnel counts (Applied/Approved columns on dinners list) and "Approved Without Ticket" lists on dinner detail pages. Applications inbox and tickets are unaffected.
- `/admin/tickets` page: cross-dinner ticket list with all 1,350+ tickets (paginated past the 1,000-row PostgREST cap). Columns: Purchased, Member (strikethrough if kicked out), Dinner (formatted "May 7th, 2026"), Qty, Amount, Type, Source, Status (colored pills). All columns sortable, default reverse-chron by purchased_at. Search by member name. Row click navigates to dinner detail.
- `/admin/credits` page removed. Credits now surface contextually: "Credit" button on dinner ticket rows, "Apply Credit" button on member detail. Nav updated: Tickets added between Dinners and Applications, Credits removed.
- Pagination audit: all admin list queries that could exceed the 1,000-row PostgREST cap now use the `fetchAll` helper with `.range()`. Paginated: applications (718 rows), members (634 rows), tickets (1,350 rows), dinners funnel aggregations (applications + tickets). Bounded queries (`.single()`, `.limit()`, count-only, scoped to single dinner/member) left as-is.

## What's done (Phase 4, in progress)

- Schema: `members.attendee_stagetype` (TEXT, singular) → `members.attendee_stagetypes` (TEXT[], NOT NULL DEFAULT `'{}'`). All 636 existing members backfilled to single-element arrays. The singular column is dropped. `applications.attendee_stagetype` is unchanged — application form remains single-select.
- RPCs `add_member_with_application`, `approve_application`, `link_application_to_member` now write `members.attendee_stagetypes = ARRAY[<application stagetype>]`. `link_application_to_member` previously did not touch member stagetype; it now overwrites. Re-approving an application overwrites any multi-role customization the member added — intentional for now.
- Pricing logic in `getTicketInfo()` (in `src/lib/ticket-assignment.ts`) now takes `string[]` and uses priority ladder: Active CEO → $40 (CEO Ticket); else Investor → $100; else Exited CEO → $40; else Guest → $40; fallback CEO Ticket $40. Active CEO trumps Investor when both are present.
- Trigger `trg_revoke_community_access_on_kickout` (BEFORE UPDATE OF kicked_out on members): when `kicked_out` flips false→true, sets `has_community_access = false`. Un-kicking does NOT auto-restore — admin must set manually if needed.
- Proxy `/portal/*` guard now requires `has_community_access = true` (admin email bypasses). Members without it redirect to `/`. With the kick-out trigger above, no separate `kicked_out` check is needed.
- Member detail Type field still single-select in the admin UI (Phase 4 will introduce multi-select); the admin server action wraps the chosen value in a single-element array when writing `attendee_stagetypes`.
- **Global top nav** (`src/components/top-nav.tsx`): renders on every authenticated page (portal + admin). Left: "Thunderview OS" logo → `/portal`. Center-left: Tickets → `/portal/tickets`, Community → `/portal/community`, Last Month's Intros & Asks → `/portal/recap`. Active-state highlighting. Right: avatar circle with member initials (first_name[0] + last_name[0]). Avatar dropdown: Update Profile → `/portal/profile`, Admin → `/admin` (admin/team only), Sign Out. Admin sidebar now sits below the top nav (was full-height). Admin shell header removed — top nav replaces it.
- **Portal layout** (`src/app/portal/layout.tsx`): wraps all `/portal/*` pages with TopNav. Fetches member data for initials + role. Auth check.
- **Portal home page** (`/portal`): two-column layout (stacks on mobile). Left column: four full-width nav buttons (Buy A Dinner Ticket → `/portal/tickets`, Update Your Profile → `/portal/profile`, View The Community → `/portal/community`, Check Last Month's Intros & Asks → `/portal/recap`). Right column: inline editable form with Intro/Ask/Contact. Single Save button with toast.
- **Portal save action** (`savePortalProfile` in `src/app/portal/actions.ts`): compares old vs new values; only writes changed fields. Sets `intro_updated_at = now()` only when Intro text actually changed; sets `ask_updated_at = now()` only when Ask text actually changed. Contact-only changes touch neither timestamp. No-op when nothing changed (no DB write, "No changes" toast). Admin edits elsewhere do NOT touch these timestamps (confirmed: `src/app/admin/members/[id]/actions.ts:15-16` explicitly skips them).
- **Profile editor** (`/portal/profile`): single-column form with all editable member fields. Profile details section: first_name, last_name, primary email, company_name, company_website, linkedin_profile, attendee_stagetypes (multi-select checkboxes). Intro & Ask section: current_intro (textarea), current_ask (textarea), contact_preference (dropdown: LinkedIn/Email). Single Save button with toast. Same timestamp logic as portal home form — `intro_updated_at`/`ask_updated_at` only set when respective text changes. Primary email change: if new email exists in member_emails, flips primary via `swap_primary_email` RPC; if new email, inserts row with `source = 'manual'` then flips. Old email rows persist as secondary.
- **Community directory** (`/portal/community`): searchable, sortable table of members with `has_community_access = true` and `kicked_out = false`. Columns: Name, Company, Role. Search hits: first_name, last_name, full name, company_name, company_website, linkedin_profile, current_intro, current_ask, contact_preference, attendee_stagetypes. Default sort: first_name ascending. All columns sortable. Uses `fetchAll` with `.range()` for pagination past 1,000-row PostgREST cap (470 community members). All rows rendered client-side after full fetch. Row click routes to `/portal/members/[id]`.
- **Member profile page** (`/portal/members/[id]`): read-only view of a member's profile for other community members. Shows: name, company, website (link), LinkedIn (link), role (formatted), primary email, preferred contact (capitalized), intro, ask. No demographics (gender/race/orientation — those live on applications only). Returns 404 if member is `kicked_out = true` or `has_community_access = false`. Self-view: shows "Edit Profile" button linking to `/portal/profile` when viewer's member_id matches the page's member.
- **Recap page** (`/portal/recap`): shows attendees of the most recent completed dinner (latest `dinners.date < today` in MT). Attendees = members with a `fulfillment_status = 'fulfilled'` ticket for that dinner. Excluded: kicked-out, `has_community_access = false`, refunded, credited, purchased (not yet fulfilled) tickets. Marketing-opted-out still shown. Deduplicated by member_id (qty=2 tickets show one row for the primary member). Each card shows name (links to `/portal/members/[id]`), company, full intro text, full ask text. Empty intro/ask hidden (only show what they have). Header: "Thunderview Dinner — [formatted date]" with attendee count. Members with intros/asks sorted first, then others. Empty state for no past dinners.
- **Profile pictures** (Sprints 6–7): Supabase Storage bucket `profile-pics` (public-read, authenticated-write, RLS: members can only upload at their own member_id path). Column `members.profile_pic_url` TEXT NULL stores full public URL with `?v={timestamp}` cache-bust. Upload on `/portal/profile`: client-side crop via `react-easy-crop` (square aspect, zoom 1–3) in a modal (`crop-modal.tsx`), then server-side processing via `sharp` — resize to 400×400, convert to WebP, strip EXIF. HEIC files skip client crop (browser can't render) and fall back to server center-crop. Max 5MB, accepts JPEG/PNG/WebP/HEIC. Stored at `profile-pics/{member_id}.webp` (upsert overwrites). Photo upload and removal both save immediately (spinner overlay shown, no need to click Save). Reusable `<MemberAvatar>` component (`src/components/member-avatar.tsx`): shows pic if set, initials circle if not. Sizes: sm (28px), md (40px), lg (120px). Displayed in 7 locations: portal profile upload, portal member profile page, community table rows, recap cards, top-nav dropdown trigger, admin member detail heading, admin members table rows, admin dinner detail ticket rows.

## What's done (Sprints 8–12)

- **Stripe Checkout** (Sprint 8): `purchaseTicket` server action creates a Stripe Checkout Session with inline `price_data` (no pre-configured Products). Metadata includes `member_id`, `dinner_id`, `ticket_type`, `quantity`, `amount_paid`. Webhook at `/api/webhooks/stripe` handles `checkout.session.completed` — inserts ticket as `purchased`, auto-fulfills only if dinner is the next upcoming (via `getTargetDinner()`). Idempotency via `stripe_session_id` partial unique index. Stripe columns on tickets: `stripe_session_id`, `stripe_payment_intent_id`, `stripe_refund_id`.
- **Stripe refunds** (Sprint 9): Refund button calls `stripe.refunds.create()` before DB status flip. Guest-only refund = $40 (fixed, not half). Historical tickets and tickets without `stripe_payment_intent_id` skip Stripe. Errors surface inline in refund modal. Refund and Credit buttons are hidden for past dinners (dinner date < today in MT) — no refunds or credits once a dinner has passed.
- **Ticket purchase flow redesign** (Sprint 10): Application form no longer asks for preferred dinner date (`preferred_dinner_date` column made nullable, no longer written). Portal `/portal/tickets` shows explicit dinner dropdown (most recent past dinner + next 3 upcoming) instead of auto-assignment. Member picks dinner, clicks Buy. December guest upsell collapsed into two side-by-side buttons on same page (no intermediate guest/cart pages). `getTargetDinner()` simplified to just return next upcoming dinner.
- **Per-dinner guests_allowed** (Sprint 10.5): `dinners.guests_allowed` BOOLEAN replaces hardcoded December month check. `allowsGuestTicket()` predicate in `src/lib/ticket-rules.ts`. Admin toggle on `/admin/dinners` list (Guests column, click Yes/No → confirmation modal, spinner while saving). Backfilled: 4 December dinners = true.
- **Admin surface cleanup** (Sprint 11): Removed Preferred Dinner from applications UI. Removed Applied/Approved columns from dinners list. Dinner detail: removed Pending square, renamed Fulfilled → Purchased (counts purchased + fulfilled), removed Approved Without Ticket section. Newest-first ticket sort + blue "new" pill for first-time members. Intro/Ask status scoped to next upcoming dinner only. Dashboard: Tickets Sold now sums quantity excluding refunded/credited; New Apps excludes rejected. Comp Ticket button on member detail (payment_source='comp', amount_paid=0, auto-fulfilled, no Credit/Refund buttons shown). `payment_source` CHECK: squarespace, credit, historical, portal, comp.
- **Fulfillment logic** (Sprint 12): Tickets auto-fulfill only when `dinner_id` matches next upcoming dinner. Future-beyond-next tickets stay `purchased`. Dinner dropdown filters out dinners where member already has a purchased/fulfilled ticket. `/admin/dinners` default sort = date DESC with auto-scroll to next upcoming dinner. Portal home shows upcoming-ticket banner with intro/ask freshness nudge (updates on save without reload). `fulfillment_status` values renamed: `pending` → `purchased` throughout code and DB.
- **Sprint 13 — Email wiring + bug fixes:**
  - All transactional emails wired to trigger events (approval, re-application, rejection, fulfillment, morning-of). Shared `src/lib/email-send.ts` handles template loading + Resend dispatch.
  - Fulfill-tickets cron (`/api/cron/fulfill-tickets`): daily at 1pm UTC, flips purchased→fulfilled 27 days before dinner + sends fulfillment email. Idempotent (only touches `purchased` tickets).
  - Morning-of cron idempotency: `dinners.morning_of_sent_at` column prevents duplicate sends on retry.
  - Admin notification on new application: emails `eric@marcoullier.com` with applicant details + link to `/admin/applications/[id]`.
  - **Bug fix: `has_community_access` was `false` on member creation.** All three member-creation RPCs now set `true`. Backfilled 161 existing members. Root cause: column was renamed from `has_attended` (ticket-triggered) to `has_community_access` (approval-triggered) but the RPCs and import were never updated to match the new semantics.
  - **Bug fix: all email sends must be `await`ed.** Every `sendXxxEmail()` call was fire-and-forget (no `await`). On Vercel serverless, the function terminates when the response is sent — unawaited promises get killed. All 8 call sites now awaited. Crons already awaited correctly.
  - **Bug fix: proxy used session client for member lookups.** The proxy queried `member_emails` with the session client (anon key + user cookies), subject to RLS. RLS blocked queries for non-admin users, so no non-admin user could ever reach `/portal` or `/admin` as team. Only `eric@marcoullier.com` worked because the hardcoded admin check bypasses the query. Fixed: proxy now uses the service role client for team and community access checks.
  - **Bug fix: auth cookie propagation on redirects.** `/auth/confirm` and `/auth/callback` set session cookies via `cookieStore.set()` but returned a separate `NextResponse.redirect()` that didn't carry them. Now explicitly applies cookies to the redirect response.
  - **Switched Supabase auth SMTP to Resend custom SMTP.** Configured in Supabase dashboard (not code). Eliminates the 4/hour rate limit and the injected unsubscribe footer. Sender: `team@thunderviewceodinners.com`.
  - Login input text color fixed (was near-invisible on white background).

## What's done (Design system — Sprints 14–15)

- **Design system installed** (`design-system/` at repo root): tokens, fonts, UI kit prototypes, brand assets. Source of truth for all visual decisions. See `design-system/README.md` for positioning, content rules, visual foundations, layout invariants, iconography, and component rules.
- **Fonts swapped**: Geist/Geist_Mono replaced with Inter (body/UI), Fraunces (display, variable opsz axis), JetBrains Mono (code) via `next/font/google` in `src/app/layout.tsx`.
- **Token architecture**: Design tokens use `--tv-` prefix in `:root` to avoid circular references with Tailwind 4's `@theme inline` (which writes to the same CSS custom property namespace). All tokens exposed to Tailwind via `@theme inline` in `src/app/globals.css`. Design system source (`design-system/colors_and_type.css`) uses unprefixed names — the `--tv-` prefix is an app-layer concern only.
- **No dark mode.** The `prefers-color-scheme: dark` media block was removed. Thunderview is explicitly cream-on-cream, never dark.
- **UI primitives** in `src/components/ui/`: Button (with `asChild` for wrapping Links), Card, Pill, Input, Textarea, Select, Label, FieldHelp, typography wrappers (Eyebrow, H1–H4, Lede, Body, Small). All pages compose these — no inline buttons, cards, or form inputs.
- **Brand assets** copied to `public/brand/`: 12 dinner photos (webp), wordmark SVG, monogram SVG.
- **Marketing home page** (`/`): full branded page with hero photo, stats, three-reason grid, editorial quote, photo gallery, bottom CTA. Conditional auth: anonymous → "Apply To Join", authenticated → "Buy A Dinner Ticket". Public nav with About/FAQ/Team/Gallery links (placeholder pages scaffolded).
- **All portal pages restyled**: top-nav, layout, home, profile, community directory, member view, recap, tickets. Cream backgrounds, Fraunces headings, warm borders, design system primitives throughout.
- **All admin pages restyled**: sidebar (cream-100, grouped nav), dashboard, dinners list + detail, applications list + detail, members list + detail + add-member modal, tickets list, emails index + template editors + morning-of editor. Warm tables, Pill status badges, Lucide sort arrows, Button primitives on modals.
- **Transactional email HTML shell** (`bodyToHtml()` in `src/lib/email.ts`): Resend-safe table-based layout, cream #FBF7F0 background, 600px max-width, clay-500 top border, Fraunces headings with Georgia fallback, Inter body with system sans fallback, warm footer. All CSS inline. Optional `appendHtml` parameter for morning-of attendee section. `EMAIL_FROM` = "Thunderview Team <team@thunderviewceodinners.com>".
- **`sendNewApplicationNotification`** now uses the branded email shell (was raw HTML).
- **Ticket success page removed**: Stripe success URL now redirects to `/portal?purchased=true`. Confetti fires once via `purchase-confetti.tsx`, query param cleaned up silently via `router.replace`.
- **Guest ticket button hidden** when dinner doesn't allow guests (was shown disabled at 55% opacity).
- **Intro/Ask column** on dinners list scoped to next upcoming dinner only (was showing for all dinners — pre-existing bug fixed).
- **Layout invariant tokens** added: nav height (64px), page gutters (24/48px), container widths (marketing 1040, app 1280, admin 1440), vertical rhythm (section-gap 64px, stack-gap 24px, tight-gap 12px), form spacing, table spacing, modal widths, nav internals. All navs now exactly 64px. All pages use `tv-page-gutter` or `tv-container-*`.
- **Semantic alias conformance sweep**: all raw-scale Tailwind classes (`bg-cream-50`, `border-line-200`, `text-clay-600`, etc.) replaced with semantic aliases (`bg-bg`, `border-border`, `text-accent-hover`). Remaining raw-scale refs are intentional (active nav state, Pill internals).
- **Broken motion refs fixed**: all `var(--tv-dur-fast)` / `var(--tv-ease-out)` references replaced with literal values — Tailwind arbitrary values can't resolve CSS vars for non-standard properties through `@theme inline`.
- **Mobile responsive** across all three tiers: marketing pages, portal pages, and admin pages. Two-column layouts stack on mobile, tables scroll horizontally, nav collapses appropriately. Responsive breakpoints applied during the page restyling work in these sprints and polished in Sprint 16.
- **Dev routes**: `/dev/ui` (primitive showcase), `/dev/emails/[slug]` (email template preview with sample data). Not linked from any page.
- **NEEDS DESIGN REVIEW**: Portal uses `max-w-[980px]` not the `--container-app` (1280px) token — deliberate per kit layout, consider adding `--container-portal`.
- **NEEDS DECISION**: receipt email — using Stripe's built-in receipt. Kit has a design but no sender/template/trigger built. Fulfillment hero photo skipped in email shell — would need per-template image support.

## What's done (System hardening — Sprint 16)

- **Spacing token audit**: all hand-rolled pixel values (`py-[72px]`, `px-[22px]`, etc.) and off-scale standard utilities (`mb-10`, `py-24`, `gap-12`, etc.) replaced with `--space-*` tokens across 18 files. Zero bracket-pixel spacing values remain in feature components. UI primitives (`components/ui/`) untouched.
- **`<PageHeader>` component** (`src/components/page-header.tsx`): props `eyebrow`, `title`, `lede`, `actions`, `size` (`"default"` | `"compact"`). Rhythm locked by the component — `--tight-gap` (12px) between internals, `--section-gap` (64px) default or `--stack-gap` (24px) compact after the header. 16 pages migrated (admin list pages use compact; placeholder pages use default). Detail pages and portal pages NOT migrated — see "Known gap" below.
- **`<Field>` component** (`src/components/field.tsx`): props `label`, `required`, `help`, `error`, `children`, `className`. Uses `flex flex-col gap-label-input` (8px) with `!mb-0`/`!mt-0` overrides on Label/FieldHelp to strip built-in margins. Error and help are mutually exclusive. 8 forms migrated (39 fields total). Remaining `<label>` hits are checkbox labels inside Fields and dev showcase.
- **Public pages restyled** (`/login`, `/apply`, `/apply/thanks`): warm cream palette, Fraunces headings, design system Input/Select/Button, Field-wrapped inputs. Zero `gray-*`/`blue-*`/`slate-*` classes remain. Login split into server wrapper (`page.tsx` with PublicNav) + client form (`login-form.tsx`). Apply form uses Eyebrow section headers, schedule in elevated two-column panel. Thanks page centered card with confetti preserved. Placeholder pages (`/about`, `/faq`, `/team`, `/gallery`) given `tv-paper` texture.
- **Portal pages restyled** to match `ui_kits/portal/index.html`: portal home, community, tickets (3 paths), recap, member view, profile editor. Tighter heading gaps (32px vs PageHeader's 64px section-gap). Profile editor has `border-t` separator between profile details and intro sections.
- **Admin pages restyled** to match `ui_kits/admin/index.html`: main area padding tightened to `py-7` (48px). Emails list narrowed to 720px. Member detail wrapper narrowed to 1040px, grid gap tightened to 48px. All existing patterns preserved (dl/dt/dd inline editing, STALE pill, Remove Member, Apply Credit, Comp Ticket).
- **Email template fixes** (`src/lib/email.ts`): CTA button margin-top increased from 8px to 16px. `bodyToHtml()` now post-processes bare `<a>` tags to add inline `color:#9A7A5E` (clay) since email clients strip `<style>` blocks. Tags with existing `style` attributes left untouched. `email-send.ts` unchanged.
- **Apply schedule** extended from 12 to 13 months so the schedule always includes the same month next year (e.g. April 2027 when viewing in April 2026).

### Portal back-link convention

Top-nav destinations (Home, Community, Recap) show **no** back link — the sticky top nav handles navigation. Leaf pages reached by clicking through (Tickets, Members/[id], Profile) show a back link to their logical parent: usually Portal home, except Members/[id] which links back to Community. Documented in a comment at the top of `src/app/portal/layout.tsx`. Reference mock: `ui_kits/portal/index.html`.

### Known gap: PageHeader on portal pages

`<PageHeader>` has two sizes: `default` (tv-h1 + 64px gap) and `compact` (tv-h3 + 24px gap). Portal pages need tv-h1 heading + ~32px gap — neither size fits. Portal pages currently use inline `<H1>` + `<Lede>` with manual `mb-6` instead of PageHeader. **Next step**: add `size="portal"` (tv-h1 heading + 32px gap) and migrate portal pages back to PageHeader.

### Remaining hardening opportunities

- **Shared `<DataTable>` component**: admin tables (dinners, tickets, applications, members) and the portal community table all share identical th/td class patterns. A single component would enforce table-cell-padding-x, sticky headers, sort arrows, and row-click behavior.
- **Shared `<SearchToolbar>` component**: admin pages hand-roll search input + filter tabs. A shared component would lock the toolbar layout and spacing.
- **Admin detail layout component**: member detail, application detail, and dinner detail all use back-link + heading + two-column grid with similar patterns but different enough to resist a single abstraction today.

## What's NOT done

Don't build these without an explicit prompt:

- Fulfill ticket button (manual fulfillment for tickets not auto-fulfilled) — future sprint. ~~Fulfillment cron~~ Done — `/api/cron/fulfill-tickets` flips purchased→fulfilled 27 days before each dinner and sends fulfillment email.
- `has_community_access` revoke checkbox on refund flow — allows manual revert to `false` when refunding a ticket (future sprint)
- ~~Application form~~ Done (Sprint 10) — hosted on Thunderview OS at `/apply`. Preferred dinner date field removed.
- Attendee portal: Phase 4 complete (portal home, profile editor, community directory, recap page all done).
- ~~Email sending (Resend wiring)~~ Done (Phase 5). All transactional emails wired: approval (on approve), re-application (on approve existing / link), rejection (on reject), fulfillment (on Stripe webhook auto-fulfill + comp ticket), morning-of (cron at 7am MT on dinner day). Templates editable at `/admin/emails/*`. From: `team@thunderviewceodinners.com`. Refund confirmations handled natively by Stripe.
- ~~Stripe payment integration~~ Done (Sprint 8) — Stripe Checkout Sessions, webhook-driven ticket creation, sandbox mode.
- Bulk email templates — future sprint
- Streak API integration — Phase 7
- CoachingOS sync — Phase 10+
- LinkedIn URL matching for automatic duplicate detection across applications and members
- Side-by-side comparison when re-application has different data than existing member record (name, company, website changes)
- Automatic member field updates from re-application data
- Custom receipt email — kit design exists in `design-system/ui_kits/` but won't be built. Using Stripe's built-in receipt instead

## Upcoming work

- ~~Transactional emails via Resend~~ Done — all five templates wired to events
- ~~Fulfillment cron~~ Done — `/api/cron/fulfill-tickets`
- ~~Design system~~ Done — tokens, fonts, primitives, full page restyling, email shell, layout invariants
- Swap Stripe Production scope to live-mode keys (currently sandbox in both scopes)
- Dead code cleanup: remove orphaned `/portal/tickets/guest/`, `/portal/tickets/cart/page.tsx`, `/portal/tickets/cart/purchase-button.tsx`
- ~~Restyle remaining unstyled pages: `/login`, `/apply`~~ Done (Sprint 16)
- Add `--container-portal: 980px` token (portal pages use 980px, not the 1280px `--container-app` token)
- Add `size="portal"` to PageHeader (tv-h1 + 32px gap) and migrate portal pages to use it
- ~~Receipt email: decide whether to build custom (kit design exists) or keep Stripe built-in~~ Decided — keeping Stripe's built-in receipt
- Fulfillment email hero photo: per-template image support if wanted
- Page-by-page detail polish pass (next session)

## Pre-launch checklist (before real users hit this)

- [x] Switch Supabase SMTP from built-in to Resend (done Sprint 13 — configured in Supabase dashboard)
- [x] Verify Thunderview sending domain in Resend (SPF, DKIM, DMARC) — `thunderviewceodinners.com` verified. DKIM TXT + SPF MX/TXT on the `send` subdomain in Squarespace DNS; no conflict with Google Workspace MX/SPF on root domain. DMARC at `_dmarc` with `v=DMARC1; p=none` (monitoring mode)
- [x] Customize magic link email template (subject, body, branding) — branded HTML shell matching `bodyToHtml()`, subject "Sign in to Thunderview", template in `tmp/magic-link-template.html`. Apply via Supabase dashboard > Authentication > Email Templates > Magic Link
- [x] Verified all Supabase auth email templates use the `/auth/confirm?token_hash=...&type=email` pattern (not `{{ .ConfirmationURL }}`)
- [x] Confirm From address is a Thunderview domain (`team@thunderviewceodinners.com` via Resend custom SMTP)
- [x] Confirm injected unsubscribe footer is gone (custom SMTP eliminates it)
- [ ] Set Vercel preview env vars (currently missing anon key + service role key in preview scope)

## Known issues / gotchas

- **PKCE flow uses `/auth/confirm`, not `/auth/callback`.** The `@supabase/ssr` package defaults to PKCE. Supabase's magic link email template generates URLs with `token_hash` query param pointing to `/auth/confirm`. The `/auth/callback` route (code exchange) also exists as a fallback. Both routes create their own `createServerClient` inline with direct `cookieStore` access — do not use the shared `lib/supabase/server.ts` helper in auth routes, as cookies won't propagate on redirects.
- **Next.js 16 uses `proxy.ts` instead of `middleware.ts`.** The file is `src/proxy.ts` with `export async function proxy(request)`. The `middleware` convention is deprecated.
- **Vercel preview env vars partially missing.** `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are not set for the preview environment due to a Vercel CLI plugin bug. Add manually in Vercel dashboard if branch deploys are needed.
- ~~**Supabase built-in SMTP is rate-limited.**~~ Resolved — switched to Resend custom SMTP. New rate limit: 30/hour (adjustable in Supabase dashboard → Authentication → Rate Limits).
- **Supabase/PostgREST default row cap.** Supabase limits query results to 1,000 rows by default. This is silent — no error, just truncated results. Any query that might return more than 1,000 rows MUST paginate. This has caused bugs across multiple projects. Always account for it.
- **Portal pages and proxy use admin client for data queries.** RLS policies on most tables (tickets, dinners, applications, members) only grant SELECT to admin/team. Portal pages authenticate the user via the session client (`createClient`), then use the admin client (`createAdminClient`) for all data reads and writes. The proxy also uses the service role client for member lookups (team check, community access check) — using the session client here caused all non-admin logins to fail because RLS blocked the query. Same pattern as the `/apply` form: authenticate with session, query with admin.
- **Server action body size limit is 5MB** (set in `next.config.ts` under `experimental.serverActions.bodySizeLimit`). Default Next.js limit is 1MB. Raised because profile pic uploads send a PNG blob from the client-side crop canvas, which can exceed 1MB for larger source images. If this limit needs changing, it's in `next.config.ts`.
- **CSS token `--tv-` prefix is required in `globals.css`.** Tailwind 4's `@theme inline` writes to the same CSS custom property namespace as `:root`. Without the prefix, `--font-sans: var(--font-sans)` is circular. The design system source (`design-system/colors_and_type.css`) uses unprefixed names; `globals.css` adds the `--tv-` prefix; `@theme inline` references `var(--tv-*)`. If you add a new token, follow this pattern.
- **Do NOT define `--spacing-N` in `@theme inline`.** Tailwind 4 computes numeric spacing utilities (`h-9`, `p-4`, `gap-6`) as `calc(var(--spacing) * N)`. Defining `--spacing-9` overrides that step to our non-linear scale (96px), so `h-9` silently becomes 96px instead of 36px. Only semantic aliases (`--spacing-stack`, `--spacing-section`, `--spacing-tight`, `--spacing-form-row`, `--spacing-label-input`, `--spacing-button-grp`, `--spacing-gutter-sm/lg`, `--spacing-nav`) belong in `@theme inline`. Use `var(--tv-space-5)` in arbitrary values when you need a design-system spacing step: `gap-[var(--tv-space-5)]`. For literal pixel dimensions (avatar sizes, icon sizes), use pixel arbitrary values: `h-[36px] w-[36px]`.
- **Motion values must be literals in Tailwind classes.** `duration-[var(--tv-dur-fast)]` doesn't resolve — Tailwind arbitrary values for non-standard properties can't reach `:root` vars through `@theme inline`. Use literal values: `duration-[120ms]`, `duration-[220ms]`, `duration-[420ms]`.
- **Semantic alias rule.** App code uses `bg-bg`, `text-fg1`, `border-border` — NOT raw scale names like `bg-cream-50`, `text-ink-900`, `border-line-200`. The raw scale stays in `:root` as underlying definitions. Same for `text-accent-hover` (not `text-clay-600`), `bg-accent` (not `bg-clay-500`). Exceptions: `bg-ink-900`/`text-cream-50` for active nav/filter state (no semantic alias for this pattern), Pill component internals.
- **Button `asChild` pattern.** Any `<Link>` that looks like a button must use `<Button asChild><Link href="...">Label</Link></Button>`. No anchor-styled-as-button with hand-tuned padding/colors. The Button component merges its classes onto the child element.
- **`bodyToHtml()` wraps in a full HTML document.** It's no longer just `\n` → `<br>`. Every caller gets a branded shell. The `appendHtml` parameter lets you inject pre-rendered HTML inside the shell (used by morning-of for attendee list). Don't concatenate HTML after calling `bodyToHtml()` — it would land outside the `</html>` tag.
- **Stripe sandbox does not auto-send receipts.** Even with `receipt_email` set on the Checkout Session and the dashboard toggle enabled, sandbox mode silently skips receipt emails. Integration is correct — auto-send will be validated at Phase 8 live cutover. Do not debug further.
- **`has_community_access` means "is an approved member," not "has attended a dinner."** This column was originally named `has_attended` and set only by the ticket INSERT trigger. It was renamed to `has_community_access` in Phase 3 but the RPCs still wrote `false` on member creation until Sprint 13. Fixed: all member-creation RPCs now set `true`. The ticket trigger also still sets `true` (harmless redundancy). If you're writing new code that creates members, always set `has_community_access = true`.
