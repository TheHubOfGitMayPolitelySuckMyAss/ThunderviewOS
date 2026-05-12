@AGENTS.md

# Thunderview OS

Next.js 16 + Supabase + Vercel. Replaces a Squarespace/Sheets/Streak stack for a ~40-member CEO dinner program.

## Operating rules (read first)

- Cloud-first. No local-only scripts or dependencies.
- Don't invent requirements. If something seems missing, flag it — don't fill it in.
- When Eric reports a bug, ask at least one clarifying question before offering an explanation. Don't infer the cause.
- Prefer omission over inference. If uncertain, say so.
- Don't validate, praise, or smooth ambiguity. Disagree when warranted.
- When Eric points you at a resource (token, file, config) for a task, finding it is implicit authorization to use it. Don't ask permission to proceed.
- **This doc is for you (Claude), not Eric. He doesn't read it.** Update existing sections when work changes the system's state — don't ask permission, just do it. Don't append "What's done in Sprint N" sections; sprint history is in git log. The doc reflects the system as it is now, not how it got here. **Compress proactively** — every token here is loaded on every turn. Verbose prose gets in your way.
- Separate from CoachingOS/DigiEric — separate repo, separate Supabase project. Don't conflate.
- The v4 handoff doc (in Eric's chat sessions, not the repo) is the canonical product spec. Eric will paste relevant sections.

## Cross-cutting invariants

Easy-to-violate design choices that aren't obvious from local reading.

- **Three-table model.** `applications` (vetting events, persist forever, includes demographics), `members` (current-standing approved people, no demographics), `tickets` (paid entry per dinner). Plus `credits`, `dinners`. Demographics on applications never copy to members.
- **No row deletions.** Soft-delete via `kicked_out` on members. Rejected applications stay — that table IS the suppression list. **Narrow exception:** "Delete as spam" on `/admin/applications/[id]` hard-deletes a pending application (and its Streak Applied box) via `deleteSpamApplication`. Reject is wrong for spam because it emails the spammer and adds their address to the suppression list — blocking any future real applicant who shares it. Audit row survives via the trigger. Pending-only.
- **Multi-email members via `member_emails`.** Auth, ticket matching, and application matching look up against ALL of a member's emails, not just primary. Use `findMemberByAnyEmail` from `@/lib/member-lookup` for any auth lookup keyed by email — including hardcoded-admin lookups by `eric@marcoullier.com`. Filtering `member_emails` by `is_primary = true` in an auth context is the canonical bug shape and silently breaks for users who log in via a secondary. Primary = email on most recent approved application. Tickets do NOT change primary (Stripe autofill is noisy). Hard bounce on primary auto-promotes most-recent active secondary via `swap_primary_email` RPC.
- **Audit attribution via `X-Audit-Actor` request header.** Server actions writing to audited tables for human actions use `createAdminClientForCurrentActor()` (in `src/lib/supabase/admin-with-actor.ts`). Everywhere else uses `createAdminClient(reason)` with one of: `"cron"`, `"webhook"`, `"public-flow"`, `"read-only"`, `"system-internal"`. The reason parameter is required — there's no zero-arg overload — so the choice between attributed and unattributed is always deliberate at the callsite. Picking `createAdminClient` for a human-driven write to an audited table = audit row with `actor_member_id = NULL` = doesn't appear in the People feed.
- **Best-effort Streak sync.** Failures land in `system_events` as `error.caught` with `source: 'streak_push'`. Never roll back the OS commit on a Streak failure. Manual repair = re-run the action.
- **Admin = `eric@marcoullier.com` (hardcoded). Team = members with `is_team = true AND kicked_out = false`.** Same admin UI access. Role check: `is_admin_or_team()` Postgres function (SECURITY DEFINER), used in RLS, proxy, and admin layout.
- **One Ask per member, overwritten on save.** `members.current_ask`. Prefill logic on portal home: `ask_updated_at > last_dinner_attended`. Char limits: intro 1,000, ask 250, give 500. DB columns are unconstrained TEXT.
- **Directory shorts are AI-summarized on save.** `members.current_intro_short` / `current_ask_short` / `current_give_short` (target ~60 chars, unconstrained TEXT). `summarizeChangedFields` in `src/lib/summarize-profile.ts` (Claude Sonnet 4.6) is called from `savePortalProfile` / `saveProfile` for only the fields that changed. Lazy client init; API failures are caught and logged, the user's save still completes, prior short persists. Every call emits one `system_events` row: success → `summary.generated`; failure → `error.caught` with `metadata.source = 'summarize-profile'`. `/portal/community` table reads from shorts; featured-member card and `/portal/members/[id]` read from full text.
- **`has_community_access` means "is an approved member," not "has attended."** Set `true` by all member-creation RPCs AND by the ticket INSERT trigger (harmless redundancy). Revoked when `kicked_out` flips false→true. Does NOT auto-restore on un-kick.
- **`fulfillment_status='fulfilled'` means "dinner-details email has been sent." It does NOT mean attended.** Attendance isn't tracked. The only purpose of `fulfilled` is gating the fulfillment email. Tickets for the next upcoming dinner auto-fulfill on Stripe webhook insert. Tickets for further-out dinners stay `purchased` until the daily fulfill-tickets cron flips them once the calendar rolls into the dinner's month.

## Trigger-managed columns

Wire-them-wrong-if-you-treat-as-ordinary columns:

- `members.first_dinner_attended` — set by ticket INSERT trigger if currently null. On refund/credit, reverts only if it matches the refunded ticket's dinner.
- `members.last_dinner_attended` — set by `post-dinner` cron, NOT by the ticket INSERT trigger. (Trigger removed because fulfillment can happen for future dinners.) On refund/credit, recalculated as MAX of remaining fulfilled tickets for past dinners.
- `members.intro_updated_at` / `ask_updated_at` — no trigger. Set explicitly by portal save action only when the respective text changes. Admin edits do NOT update these.
- `members.current_intro_short` / `current_ask_short` / `current_give_short` — no trigger. Set by `summarizeChangedFields` inside the portal save actions when the corresponding full field changes in the same save. Backfill stale or missing rows via `POST /api/admin/backfill-shorts`.
- `members.marketing_opted_out_at` — trigger sets to `now()` on flip-false, clears on flip-true.
- All audit triggers named `zzz_audit_row_change` so they fire LAST among same-timing AFTER triggers (Postgres fires alphabetically). Otherwise the audit snapshot misses sibling-trigger updates.

## Auth (gotchas, not flow)

The flow is standard Supabase magic link. The non-obvious parts:

- **PKCE uses `/auth/confirm` (token_hash), not `/auth/callback` (code).** Both routes exist; `/auth/callback` is fallback. Both create their own `createServerClient` inline with direct `cookieStore` access — do NOT use `lib/supabase/server.ts` in auth routes (cookies don't propagate on redirects).
- **Magic link template MUST use `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email&email={{ .Email }}`.** Not `{{ .ConfirmationURL }}` (verifies at Supabase's endpoint, never establishes session). Not `{{ .SiteURL }}` (hardcodes production, breaks preview deploys). Configured via Supabase Management API, not dashboard.
- **Supabase Redirect URLs allow-list needs apex AND www.** When `emailRedirectTo` (`${window.location.origin}/auth/confirm`) doesn't match an allow-list entry, Supabase silently falls back to Site URL — symptom is the magic link landing at `/?token_hash=...` instead of `/auth/confirm`, no auth flow fires. Both `thunderviewceodinners.com/**` AND `www.thunderviewceodinners.com/**` must be listed because either origin can produce the login form. Preview deploys need their vercel.app wildcard too.
- **Every email in `member_emails` needs its own `auth.users` row.** GoTrue stores one row per email; `signInWithOtp({email})` fails with "Signups not allowed for otp" if the typed email lacks an `auth.users` row, before any magic link is generated. Any code path inserting into `member_emails` MUST call `ensureAuthUsersForMember(memberId)` from `src/lib/ensure-auth-user.ts` afterward (loops every email on the member, idempotent). Single-email `ensureAuthUser(email)` still exists for legacy; new sites prefer the per-member helper. Member can't log in? Check `auth.users` not just `member_emails`.
- **`ensureAuthUser` patches GoTrue NULL columns.** Supabase's `admin.createUser()` leaves `email_change` and `email_change_token_new` NULL, GoTrue scans them into non-nullable strings, OTP request fails with "Database error finding user". Fix is the `updateUserById` call inside `ensureAuthUser`.
- **Proxy uses service-role client for member lookups** (team check, community access). Session client there subjects the query to RLS, blocks non-admin login. Hardcoded admin email check bypasses, so it would silently work for Eric only.
- **Auth cookies must apply to redirect responses.** `/auth/confirm` and `/auth/callback` set cookies via `cookieStore.set()` AND apply them to the `NextResponse.redirect()` explicitly. Returning a separate redirect drops the cookies.
- **`auth.login_failed` suppresses post-success replays.** PKCE tokens are single-use; back-button / double-click / email-client prefetch re-submits a consumed token and produces "Email link is invalid or has expired." Before logging `auth.login_failed`, `/auth/confirm` checks `system_events` for an `auth.login` row for the same member in the last 60s; if found, the failure is silently dropped. Real failures (no recent success) still log. `/auth/callback` doesn't log failures at all — no suppression needed there.

## Streak integration

Two-way sync. OS is source of truth; Streak is the visible CRM. Best-effort: failed pushes log + swallow, never roll back OS state.

- **Library at `src/lib/streak/`.** `safe-push.ts` wrappers are the only thing call sites use; raw `push.ts` primitives throw and are confined to the lib.
- **Stage precedence (8 stages, top-down, first match wins):** `Team` (is_team) → `Opted Out` (!marketing_opted_in OR kicked_out) → `Bounced` (≥1 email AND every email bounced; vacuous zero-email case excluded) → `Has Ticket` → `Not This One` → `Attended` → `Approved` → `Applied`. Pure function in `compute-stage.ts`. Stage names must match Streak verbatim — bootstrap throws on missing stages, doesn't auto-create them.
- **Two API hosts/versions.** v1 (boxes/fields/pipelines) at `https://www.streak.com/api/v1/`. v2 (Contacts) at `https://api.streak.com/api/v2/`. Client takes a `version: 1 | 2` flag.
- **`teamKey` resolution: pull from `getPipeline(pipelineKey)`.** There is no public `/users/me/teams` endpoint; that path 400s.
- **`updateContact` is NOT team-scoped despite create being team-scoped.** Use `/api/v2/contacts/{contactKey}`. The team-scoped variant 400s.
- **`addContactToBox` REPLACES the contacts array.** Body shape `{ contacts: [{ key }] }` (array of objects keyed `key`); other shapes silently fail. Fine for one-canonical-contact-per-box. Multi-contact would require fetch + merge.
- **Contacts are required for Streak mail merge.** Box columns alone don't render in merge. Push primitives create/attach a Contact after fields. Email selection: primary unless bounced AND a non-bounced alternative exists. Box's email field stays primary regardless of bounce (canonical display); contact email may differ (deliverable).
- **Inbound webhook auth via `?secret=` query param** (`STREAK_WEBHOOK_SECRET`) — Streak's automation builder lacks HMAC and custom headers. Routes (`/api/webhooks/streak/{opted-out,not-this-one}`) return 200 on internal errors so Streak doesn't retry indefinitely; only secret-check failures return 401.
- **Rate limiter:** in-process token bucket ≤8 req/sec, exp backoff on 429 (max 3 retries), single retry on 5xx. Every call emits `streak.api_call` to `system_events`.
- **`STREAK_API_KEY` set via REST API, not CLI.** Vercel CLI's `vercel env add NAME preview` can't set "all preview branches" non-interactively. PATCH/POST `/v9` or `/v10` directly with `gitBranch: null`.

## Audit logging

`audit.row_history` table in `audit` schema. SECURITY DEFINER trigger snapshots OLD/NEW JSONB on INSERT/UPDATE/DELETE.

- **Trigger naming:** `zzz_audit_row_change` (fires last alphabetically, captures sibling-trigger updates).
- **Audited tables (9):** members, applications, tickets, credits, member_emails, dinners, dinner_speakers, email_templates, email_events.
- **NOT audited:** system_events (already append-only), monday_before_*, monday_after_* (sent-lock triggers exist), auth.*, storage.*.
- **`actor_member_id` populated from `X-Audit-Actor` request header.** See `createAdminClientForCurrentActor()`. Pooling-safe — `request.headers` is per-request GUC scoped to the transaction.
- **`activity_feed` view requires explicit grants on `audit` schema:** `USAGE ON SCHEMA audit` + `SELECT ON audit.row_history` to `service_role` and `authenticated`. The view is `WITH (security_invoker = true)` — without grants, "permission denied for table row_history" with no fallback.
- **Don't grant `auth.users` to service_role** (contains password hashes). The view uses `actor_member_id` directly, no `auth.users` join.
- **TRUNCATE and DROP TABLE bypass row-level triggers** — audit doesn't help, Supabase PITR does.

## Activity feed

Three feeds (People, System, Marketing) over `system_events` ∪ `email_events` ∪ `audit.row_history`. Backs `/admin/operations` + Member History on `/admin/members/[id]`.

- **Filtering is in `getActivityFeed` (`src/lib/activity-feed/index.ts`), NOT in the view.** The view UNIONs everything; each feed applies its own filter. Directory layout: `index.ts` (orchestration), `enrich.ts` (batch lookups), `refine.ts` + `refiners/<table>.ts` (per-table audit-row refinement), `subject-labels.ts`, `page-paths.ts`, `types.ts`, `filters.ts` (PEOPLE_FEED_* / SYSTEM_FEED_*), `shared.ts`.
- **`error.caught` is the universal failure indicator.** Webhook signature failures, downstream DB write failures, cron exceptions all produce `error.caught` with `metadata.cause`. Don't proliferate failure event types like `cron.<name>.failed`.
- **System feed inclusion list is `SYSTEM_FEED_INCLUDED_TYPES`** (currently `error.caught`, `email.bounced`, `email.complained`, `email.failed`, `summary.generated`). Operational failures plus the AI-summarize success heartbeats so an operator can scan what shorts were regenerated. **If a future event warrants operator attention, add it explicitly — do not widen the filter to a prefix or wildcard.**
- **`email.bounced` means hard (Permanent) bounce only.** The `activity_feed` view classifies email_events rows by `raw_payload->data->bounce->type`: `Permanent` → `email.bounced`, anything else → `email.bounced_soft`. The underlying `email_events.event_type` is still `bounced` for both — the split lives in the view so historical rows reclassify automatically. Soft bounces still appear in scoped Member History (signal); excluded from System (noise). `bounce_type` is in the view's metadata.
- **Hard-bounce cascade emits explicit system events** so the System feed shows what we DID, not just the inbound notification. From `/api/webhooks/resend` after a Permanent bounce, in side-effect order: `email.status_set_bounced` (flipped `email_status='bounced'`), then exactly one of `email.primary_promoted` / `email.no_secondary_available` / neither-if-secondary-bounced, then `streak.bounce_synced` (metadata.outcome ∈ `primary_rotated | no_secondary_unreachable | secondary_retired`). All in `SYSTEM_FEED_INCLUDED_TYPES`. Promotion failure still lands as `error.caught` with `cause='promote_secondary_failed'`.
- **Cron heartbeat convention:** every cron fire emits exactly one row. Success → `cron.<name>` with `metadata.outcome` ('success' | 'no_op'). Failure → `error.caught`. Heartbeats are NOT in the System feed inclusion list — they exist for ad-hoc "did the cron fire today" queries.
- **`application.linked` vs `application.approved` disambiguation:** both write the same audit shape. `refineAuditRow` looks up `members.created_at`: if > 60s before audit `changed_at`, member existed pre-approval → `application.linked`. See `APPROVE_VS_LINK_BUFFER_MS`.
- **Filter dropdown shows raw audit names** (`members.update`), not refined names (`member.edited`) — refinement happens post-query in `enrichRows()`. Pre-existing design gap.
- **`streak.` prefix is NOT in `PEOPLE_FEED_EXCLUDED_PREFIXES`** (excludes `cron.`, `webhook.`, `error.`). Harmless today because all `streak.api_call` rows have `actor_id = NULL` and People requires `actor_id IS NOT NULL`. **If `actor_id` ever gets populated on Streak rows, 8,000+ flood the People feed — add `"streak."` to excluded prefixes before that happens.**
- **`getActivityFeed` returns `{ok,...} | {ok:false,error}`.** Callsites render an inline error rather than silently empty (earlier silent-empty hid three permission-denied bugs).
- **`FeedRow.subject_label` is the human-readable Subject for all event types.** Computed in `enrichRows` via ≤3 batched lookups (dinners for tickets / dinner_speakers / `/admin/dinners/{id}` page views; applications for `/admin/applications/{id}` page views). Audit snapshots supply dinner dates for `dinners` rows directly. `page.viewed` subjects resolve via a static route map plus UUID path matchers. Missing entities fall back to `(deleted member)` / `(deleted dinner)` etc.
- **`dinner_speakers` audit rows have `subject_member_id = NULL` in the view.** The view's CASE expression only sets subject_member_id for `members`, `tickets`, `applications`, `credits`, `member_emails` — not `dinner_speakers`. The speaker's `member_id` lives in `new_row`/`old_row` and must be extracted from the row snapshot.

## Page view tracking

Authenticated and anonymous navigations log `page.viewed` to `system_events`. Authenticated → People feed via `actor_id`. Anonymous → Marketing feed via opaque `anon_id` cookie (HttpOnly, SameSite=Lax, Secure in prod, 1y TTL).

- **Client component `src/components/page-view-logger.tsx`, mounted in three layouts.** Subscribes to `usePathname()` + `useSearchParams()`.
- **Server-component instrumentation does NOT work in Next.js 16 App Router.** Layouts preserve state and don't rerender on intra-layout navigation, so a server component fires only on initial mount. Must be a client component.
- **Authenticated `page.viewed` events omit `anon_id`** even if the cookie is still present. The anon→identified bridge happens once, on the `auth.login` event; afterwards authed page views are People-only.
- **`auth.login` carries `anon_id` when the cookie is present.** `/auth/confirm` reads it at OTP verification and stuffs it into `metadata.anon_id` alongside `actor_id=memberId`. Single bridge row, no backfill of prior anonymous views. `/auth/callback` (rare PKCE fallback) does NOT emit the bridge — hoist to a helper if that ever matters.
- **Marketing feed = `metadata->>anon_id IS NOT NULL`**, not a hardcoded event type. Naturally captures anonymous page views AND the auth.login bridge. The bridge appears in BOTH Marketing and People. Future event types carrying an anon cookie auto-participate.
- **Marketing UI renders bridged rows as `Visitor xxxxxxxx → Member Name`** in the Actor column. Handle = first 8 hex of UUID, hue derived from same hex (deterministic per visitor). Click chip to scope feed via `?anon=<uuid>`.
- **No PII, no IP, no UA, no fingerprinting.** Path + search params + opaque cookie value when anonymous. Eric explicitly waived GDPR/CCPA for this regional-CO program — design choice, not legal obligation.
- **Skip list:** `/api/*`, `/auth/confirm`, `/auth/callback`, `/admin/operations`, `/dev/*`. Root layout's logger additionally skips `/portal` and `/admin` (those have own layouts; otherwise we'd double-log).

## Email systems

- **Five transactional templates wired:** approval, re-application, rejection, fulfillment, morning-of. Editable at `/admin/emails/*`. From: `team@thunderviewceodinners.com`. Body uses `[member.fieldname]` placeholders.
- **HTML shell `bodyToHtml()` (`src/lib/email.ts`) wraps in a full HTML document.** Never concatenate HTML after calling. Post-processes bare `<a>` tags to inline `color:#9A7A5E` (email clients strip `<style>` blocks).
- **Marketing emails: dedicated table per type.** `monday_before_emails`, `monday_after_emails`, `one_off_blast_emails`. Each has a singleton `*_macro` that seeds drafts, a per-instance row with sent-lock trigger, JSONB `audience_snapshot` frozen at send time, and a route under `/admin/emails/`. Monday Before/After have an image table (`*_email_images`) and are dinner-anchored via `dinner_id UNIQUE`; One Off Blast is bare (subject + body + fixed CAN-SPAM, no images, no FK, multi-instance). Renderers in `src/lib/email-templates/`. 5 transactional templates use shared `email_templates`; new marketing templates follow the dedicated-table pattern.
- **Monday After's CTA promotes the NEXT upcoming dinner, NOT the anchor** (the anchor is the dinner being recapped, already past at send time). Renderer prop is named `upcomingDinner` (not `dinner`) so the bug shape is obvious. Send action and draft editor each independently query `dinners WHERE date >= getTodayMT() ORDER BY date ASC LIMIT 1`. Nullable — if dinner-generation cron hasn't created the next one yet, the CTA block is omitted; editor shows a hint. Monday Before doesn't have this split (anchor == upcoming).
- **All three marketing-email draft editors use `useUnsavedChangesGuard`** (`src/lib/use-unsaved-changes-guard.ts`). When the user has unsent edits: (a) debounced auto-save fires 1.5s after last keystroke and calls `saveDraft`; (b) `beforeunload` prompts the browser's "Leave site?" dialog. Auto-save resets `hasEdited` on success. `markEdited()` increments `editVersion`, which is the only debounce trigger. Does NOT intercept Next.js `<Link>` client-side nav (App Router lacks the API); auto-save covers that gap for most cases.
- **Sent-lock triggers are strict.** Once `status = 'sent'`, ALL UPDATEs on the email + image tables are rejected. The send action's final UPDATE succeeds because `OLD.status` is still `'draft'` at that point. Sent emails are immutable by design.
- **Audience snapshot frozen as JSONB at send time** so the recipient list survives subsequent member changes.
- **Image pipeline (`src/lib/email-image-pipeline.ts`) hard ceiling 500KB.** Iterative quality reduction (85→40), rejects if quality 40 still over.
- **`NEXT_PUBLIC_EMAIL_MODE`:** `"testing"` restricts marketing sends to admin + team; `"live"` sends to all `marketing_opted_in = true`. Production is `live`.
- **Resend webhook is account-scoped — handler filters by sender domain.** Every app on Eric's Resend account POSTs here with a valid svix sig. Handler parses `data.from` and drops anything not `thunderviewceodinners.com` (200, no event row, no log). New Thunderview sending domain → update `THUNDERVIEW_DOMAIN` in `src/app/api/webhooks/resend/route.ts`.
- **Hard vs soft bounces distinguished.** Only `bounce.type='Permanent'` flips `email_status='bounced'`, runs secondary promotion, pushes Streak. Transient / Undetermined / unknown → row persists in `email_events` for visibility; no member state changes.
- **Receipt emails: Stripe's built-in, gated by the Live-mode dashboard toggle** at Settings → Customer emails → "Successful payments." Sandbox and Live toggles are separate. Bypassed if you pass `receipt_email` on the API call (we don't — Checkout Sessions use `customer_email`). If receipts stop, check Stripe Activity timeline before assuming code regression. Custom receipt-kit design exists in `design-system/ui_kits/` — don't propose building it.
- **Admin alerts on portal ticket purchases.** Stripe webhook calls `sendTicketPurchasedNotification` after the ticket insert. Only `payment_source='portal'` triggers it (hook lives in the Stripe handler, not on the ticket INSERT trigger) — comp/credit/historical don't fire. Best-effort: failure logged and swallowed.

### Audience vs community — don't conflate

- **"Community" ≠ "marketing audience" — different magnitudes.** Community (`members WHERE has_community_access = true AND kicked_out = false`) is the dinner-going population — ~40, varies slowly. Marketing audience (`members WHERE marketing_opted_in = true` AND ≥1 `member_emails` with `email_status='active'`) is much larger (applications-never-became-members, kicked-out-never-opted-out, etc.) — recent send was ~400+. **Never infer audience size from this doc or memory — query.** The "~40-member" intro line is the program, not the send list.
- **For a specific past send, the canonical record is `audience_snapshot`** (JSONB on `monday_*_emails` / `one_off_blast_emails`). Frozen at send time, survives subsequent member changes. `jsonb_array_length(audience_snapshot)` = recipient count.

### Deliverability — what we can and can't know

- **Resend webhooks expose accept/reject, NOT inbox placement.** Receiving servers don't tell senders where they filed an accepted message — Gmail Primary vs Promotions vs Spam, Outlook Focused vs Other, all opaque. No API, webhook, or vendor can tell you "this message landed in Promotions." Don't claim otherwise.
- **We subscribe to `bounced`, `complained`, `failed`, `delivery_delayed` only** (see `EVENT_TYPE_MAP` in `src/app/api/webhooks/resend/route.ts`). No `email.delivered` locally — Resend's own dashboard has aggregate delivery counts. Opens and clicks are deliberately not wired: Apple Mail Privacy Protection prefetches every tracking pixel, corporate AV scanners do the same — the signal is unreliable industry-wide.
- **Measure inbox placement externally:** Google Postmaster Tools (`postmaster.google.com`, free, domain-level aggregate from Gmail — spam rate, IP/domain rep, auth pass rate, delivery errors; verify via DNS TXT) or seed-list tools (GlockApps / Mail-Tester / Litmus, paid per-campaign, add test addresses across providers as additional recipients). Cheap shortcut for one-off sends: ask 2-3 known recipients across providers. **Don't propose building any of this; answer the operator's question correctly.**

## Crons (Vercel)

Each emits one heartbeat row to `system_events`.

- `/api/cron/dinner-generation` — daily 1pm UTC. Generates next first-Thursday-of-month dinner if missing. Skips Jan/Jul. Runs only the day after a first Thursday.
- `/api/cron/fulfill-tickets` — daily 14:00 UTC. Uses `getTargetDinner()` + calendar-month gate. Email-first: send fulfillment email → flip status on success. Failed emails leave ticket as `purchased` for next-day retry. DB failures after email logged as CRITICAL. `.range(0, 999)` for 1k cap.
- `/api/cron/post-dinner` — daily. If yesterday was a dinner, updates `last_dinner_attended` for fulfilled-ticket holders. Also clears stale `excluded_from_dinner_id` (expired NTO state from Streak) and pushes affected members. NTO clear errors logged, don't fail the cron.

## Environment variables

Set in `.env.local` (see `.env.local.example`) and Vercel scopes.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` — **always `.trim()` when reading** (trailing newline in Vercel env has caused Stripe URL bugs).
- `STRIPE_SECRET_KEY` (sk_live), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_live, currently unused client-side), `STRIPE_WEBHOOK_SECRET` (Live destination, subscribed only to `checkout.session.completed`)
- `RESEND_API_KEY` (Production + Preview + local), `RESEND_WEBHOOK_SECRET` (svix, Production)
- `STREAK_API_KEY`, `STREAK_WEBHOOK_SECRET` (32-byte hex) — Production + Preview
- `UNSUBSCRIBE_SECRET` — HMAC for unsubscribe tokens, Production. Generate with `openssl rand -hex 32`. Without it, hardcoded default = forgeable tokens.
- `CRON_SECRET` — checked by every `/api/cron/*` route via `Authorization: Bearer ${CRON_SECRET}`. Vercel cron invocations send this automatically. Without it, an unauthenticated request can fire any cron.
- `ANTHROPIC_API_KEY` — used by `src/lib/summarize-profile.ts` to generate directory shorts on profile save. Production + Preview + local. Without it, profile saves still succeed but the `*_short` columns are left untouched (the helper catches and logs).
- `NEXT_PUBLIC_EMAIL_MODE` — `"testing"` or `"live"`. Production is `live`.

**Adding env vars to Vercel Preview scope: use the REST API, not the CLI.** All-preview-branches requires `gitBranch: null`. The CLI's interactive flow falls into a `git_branch_required` action_required loop. `PATCH /v9/projects/{id}/env/{id}` with `{"gitBranch": null}` to fix an existing entry, or `POST /v10/projects/{id}/env` with `target: ["preview"]` and no `gitBranch` for fresh.

## Supabase config (manual, not in code)

- **Site URL:** `https://thunderviewceodinners.com` (no trailing slash, no path).
- **Redirect URLs allow-list — apex AND www are BOTH required:**
  - `https://thunderviewceodinners.com/**`
  - `https://www.thunderviewceodinners.com/**`
  - `https://thunderview-os-git-*-erics-projects-*.vercel.app/**` (preview deploys)
  - `http://localhost:3000/**`
- **SMTP:** Resend custom (`team@thunderviewceodinners.com`). Default rate limit 30/hour.
- **Auth email templates:** customized via Management API (not dashboard UI). See Auth gotchas above for the required template URL.
- **Storage buckets:**
  - `profile-pics` (public-read, authenticated-write, RLS path is `{member_id}.webp`).
  - `email-images` (public-read).
  - `email-downloads` (public-read). Static docs linked from marketing emails (PDFs, DOCX). Upload: service-role `POST /storage/v1/object/email-downloads/{filename}`. Public URL: `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-downloads/{filename}`. Same filename overwrites in place — URLs stable across content swaps.

## Domain configuration

Live at `thunderviewceodinners.com` (apex + www). Cutover from `thunderview-os.vercel.app` happened 2026-05-08.

- **DNS at Squarespace's registrar** (legacy Google-Domains acquisition). Hosting is Vercel; only DNS lives at Squarespace. Squarespace TTL is locked at 4h regardless of edits. Apex A records → `216.150.1.1`, `216.150.16.1`. www CNAME → `cname.vercel-dns.com`.
- **www → apex 308 redirect MUST be set explicitly** via `PATCH /v9/projects/{id}/domains/www.thunderviewceodinners.com` with `{"redirect": "thunderviewceodinners.com", "redirectStatusCode": 308}`. Without it Vercel serves both hosts directly, which silently breaks auth (Supabase session cookies are scoped per-host — apex login leaves www unauth'd and vice versa).
- **Domain survives Squarespace hosting teardown** — it's a Google-Domains-acquired registration, paid domain-only. No risk of DNS going dark when the legacy Squarespace site is removed.

## Codebase conventions

- **Public application submissions short-circuit when email matches an active member.** `src/app/apply/actions.ts` checks `member_emails` before insert. Active (non-kicked-out) match → returns `{ success: true, alreadyMember: true }`, no application row, no admin notification, no Streak push; form redirects to `/apply/already-member`. Kicked-out re-applications fall through to the pending flow and are flagged with a red "Removed-member re-application" pill in the admin queue.
- **Admin can edit any member's profile via `/portal/profile?member_id=<id>`.** Same page/form/actions as self-edit. When viewer is admin AND `member_id` is present, page fetches that member; forms thread `target_member_id` (FormData hidden field or second arg) through `saveProfile`, `portalUpdateProfilePic`, `toggleMarketing`. Non-admin uses of the param are silently ignored. Audit attribution works automatically via `createAdminClientForCurrentActor()` — actor=admin, subject=target.
- **Admin batch Streak push at `POST /api/admin/streak-push`** — auth via `Authorization: Bearer ${CRON_SECRET}`, body `{ member_ids: string[], op?: string }`. Calls `safePushMember` on each. Use this when raw SQL has bypassed app-layer push (CSV imports, batch state changes) so Streak gets resynced without hand-rolling the push pipeline.
- **Admin batch directory-short backfill at `POST /api/admin/backfill-shorts`** — auth via `Authorization: Bearer ${CRON_SECRET}`, body optional `{ onlyMissing?: boolean = true, memberIds?: string[], concurrency?: number = 5 }`. Reuses `summarizeChangedFields`. Default re-runs only over members whose full text exists but the corresponding short is NULL. Pass `onlyMissing: false` to regenerate every short for every matched member.
- **Next.js 16 uses `proxy.ts`, not `middleware.ts`.** File is `src/proxy.ts`, function is `export async function proxy(request)`. The `middleware` convention is deprecated.
- **Server action body limit raised to 5MB** in `next.config.ts` (default 1MB). Required for profile pic upload (PNG blob from client crop canvas).
- **Photo upload is decoupled from profile save.** Portal: `portalUpdateProfilePic`. Admin: `adminUploadProfilePic`. Neither passes other profile fields. Prevents silent data loss when a new field is added but not threaded through the photo handler's FormData.
- **Default PostgREST row cap is 1,000.** Silent — no error, just truncated. Any query that might exceed 1k MUST paginate. Use `fetchAll` from `@/lib/supabase/fetch-all` (paginated `.range()` loop).
- **Portal pages use the admin client for data reads/writes.** Most table RLS only grants SELECT to admin/team. Portal authenticates via session client, then uses admin client for queries.
- **Lucide-react for all icons.** No emoji, no unicode arrows.
- **Button `asChild` pattern:** `<Link>` styled as button → `<Button asChild><Link href="...">Label</Link></Button>`. Button merges classes onto the child.

## Design system

`design-system/` at repo root. `README.md` is the visual spec. `colors_and_type.css` is the token source. `ui_kits/` has HTML prototypes.

- **CSS tokens use `--tv-` prefix in `globals.css`.** Tailwind 4's `@theme inline` writes to the same custom-property namespace as `:root` — without the prefix, `--font-sans: var(--font-sans)` is circular. Design system source uses unprefixed; `globals.css` adds the prefix.
- **Do NOT define `--spacing-N` in `@theme inline`.** Tailwind 4 computes numeric spacing utilities (`h-9`, `p-4`, `gap-6`) as `calc(var(--spacing) * N)`. Defining `--spacing-9` overrides that step to our non-linear scale (96px), so `h-9` silently becomes 96px. Only semantic aliases (`--spacing-stack`, `--spacing-section`, `--spacing-tight`) belong in `@theme inline`. Use `var(--tv-space-5)` in arbitrary values for design-system spacing steps; literal pixels for fixed dimensions.
- **Motion values must be literal in Tailwind classes.** `duration-[var(--tv-dur-fast)]` doesn't resolve — Tailwind arbitrary values for non-standard properties can't reach `:root` vars through `@theme inline`. Use `duration-[120ms]` etc.
- **Semantic alias rule.** App code uses `bg-bg`, `text-fg1`, `border-border`, `text-accent-hover`, `bg-accent` — NOT raw scale (`bg-cream-50`, `text-clay-600`). Exceptions: active nav/filter state (`bg-ink-900`/`text-cream-50`), Pill component internals.
- **Portal back-link convention.** Top-nav pages (Home, Tickets, Community, Recap) show no back link. Other portal pages (Members/[id], Profile edit) show back link to logical parent. Documented in `src/app/portal/layout.tsx`. Reference: `ui_kits/portal/index.html`.
- **PageHeader gap:** known gap. `default` = tv-h1 + 64px, `compact` = tv-h3 + 24px. Portal needs tv-h1 + 32px — neither fits, so portal pages use inline `<H1>` + `<Lede>` with manual `mb-6`. Add `size="portal"` and migrate when this becomes important.

## Tests

pgTAP suites in `supabase/tests/` covering the most load-bearing trigger/RPC pairs (~35 assertions). Expand here when adding new functions/triggers that mutate state across tables.

- **Files:**
  - `01_approve_application.sql` — new-member happy path, existing-member rebind w/ primary rotation, kicked-out short-circuit (13).
  - `02_ticket_triggers.sql` — `on_ticket_insert` sets `first_dinner_attended` + `has_community_access`; `on_ticket_fulfillment_change` recalculates `last_dinner_attended` and reverts `first_dinner_attended` only when refunded dinner matches (8).
  - `03_swap_primary_email.sql` — happy promotion, idempotent no-op, cross-member email_id raises at deferred-COMMIT (7).
  - `04_audit_trigger_ordering.sql` — `zzz_audit_row_change` snapshots NEW after all BEFORE triggers; covers kickout cascade, opt-out, intro_updated_at (7).
- **Run via Supabase MCP `execute_sql`:** paste the file body. Each wraps in `BEGIN; ... ROLLBACK;` — zero commit risk. Uses `1900-*` dates / `*@test.invalid` / random UUIDs to avoid colliding with real data.
- **`_tap_log` temp table** captures each assertion's TAP line; final `SELECT * FROM _tap_log` returns all rows (MCP only returns the last statement's result).
- **pgTAP quirks:**
  - `now()` returns tx-start time, so all rows in one tx share timestamps. Order audit rows by `id DESC`, assert timestamps `IS NOT NULL` not `>`.
  - `trg_member_has_primary_email` is `DEFERRABLE INITIALLY DEFERRED` — to assert it catches misuse, run `SET CONSTRAINTS trg_member_has_primary_email IMMEDIATE` inside `throws_ok`. Don't use SAVEPOINT to isolate failures (rollback discards `_tap_log` writes too).

## What's NOT done — don't build without explicit prompt

- Fulfill ticket button (manual fulfillment for tickets not auto-fulfilled).
- `has_community_access` revoke checkbox on refund flow.
- LinkedIn URL matching for duplicate detection across applications and members.
- Side-by-side comparison when re-application differs from existing member record (now narrowed scope: active members short-circuit at submission, so this only matters for kicked-out re-applications that land in the pending queue).
- Automatic member field updates from re-application data (same narrowed scope).
- CoachingOS sync.
- Custom receipt email (using Stripe's built-in).
- Reconciliation/retry queue for failed Streak pushes.
- Integration test for the `activity_feed` view.

