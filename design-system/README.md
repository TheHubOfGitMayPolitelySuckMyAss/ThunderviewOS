# Thunderview Design System

A design system for **Thunderview CEO Dinners** — a monthly vetted dinner for Colorado-based early-stage startup CEOs. Founded by Eric Marcoullier. ~40–50 attendees per dinner, 3+ years running, 35+ dinners, 630+ members.

**Product name for tech:** Thunderview OS (production: `thunderview-os.vercel.app`).
**This system is standalone.** Thunderview is not a sub-brand of Obvious Startup Advice or CoachingOS/DigiEric — separate identity, separate repo, separate Supabase project.

---

## Sources

Read-only references used to build this system:

- **Codebase:** `TheHubOfGitMayPolitelySuckMyAss/ThunderviewOS` (Next.js 16 + Supabase + Tailwind 4, deployed on Vercel). Explored via GitHub App; key files we mirror the structure of:
  - `src/app/page.tsx` — public marketing placeholder
  - `src/app/apply/application-form.tsx` — application form (vetting funnel)
  - `src/app/login/page.tsx` — magic-link sign-in
  - `src/app/portal/*` — member portal (home, profile, community, recap, tickets)
  - `src/app/admin/*` — admin UI (dashboard, dinners, members, applications, tickets, emails)
  - `src/components/top-nav.tsx`, `src/app/admin/admin-shell.tsx` — global chrome
  - `src/lib/email-send.ts` — transactional email senders
  - `CLAUDE.md` — product spec and architectural decisions
- **Photography:** 12 candid dinner photos shipped in `assets/photos/` (all real, all in-quantity — the founder has a large library we can pull from).
- **Founder interview notes:** pasted in the original brief. Tone, dimensions, and "what it is NOT" framing live in `README.md → CONTENT FUNDAMENTALS` and `README.md → VISUAL FOUNDATIONS`.

No Figma file, no existing brand book — this system is new. The current app codebase uses stock Geist + Tailwind grays; that is explicitly **not** the visual direction going forward.

---

## Index

Root files:
- `README.md` (this file) — positioning, content fundamentals, visual foundations, iconography
- `SKILL.md` — Agent Skill manifest (compatible with Claude Code)
- `colors_and_type.css` — all design tokens (colors, type, spacing, radii, shadows, motion) + semantic type classes (`.tv-h1`, `.tv-p`, `.tv-eyebrow`, …)
- `assets/` — photos (`assets/photos/`), logo wordmark, monogram mark
- `preview/` — design-system cards (one HTML per token cluster; surfaced in the Design System tab)
- `ui_kits/` — high-fidelity recreations of each product surface:
  - `ui_kits/marketing/` — public site (home, apply, thanks)
  - `ui_kits/admin/` — Thunderview OS admin (dashboard, apps, app-detail, members, dinners, tickets)
  - `ui_kits/portal/` — member portal (home, tickets, community, member view, recap, profile)
  - `ui_kits/emails/` — transactional templates (approval, re-app, rejection, fulfillment, morning-of, receipt)

Each UI kit is a single `index.html` with a bottom-centered screen switcher. Load `../../colors_and_type.css` — all tokens come from that one file.

```
thunderview-design-system/
├── README.md                     ← you are here
├── SKILL.md                      ← Agent SKill manifest
├── colors_and_type.css           ← CSS vars + semantic type classes
├── fonts/                        ← Inter, Fraunces, JetBrains Mono (Google Fonts via CDN)
├── assets/
│   └── photos/                   ← 12 candid dinner photos (webp)
├── preview/                      ← Design System cards (colors, type, components…)
└── ui_kits/
    ├── marketing/                ← public site (home, apply, thanks)
    ├── portal/                   ← member portal (home, community, recap, profile, tickets)
    ├── admin/                    ← admin UI (dashboard, members, applications, dinners, emails)
    └── emails/                   ← transactional email templates (Resend-friendly HTML)
```

Each UI kit has its own `README.md` plus an `index.html` that demos the kit as a click-through prototype.

---

## Positioning (one sentence)

> Most founders start companies in a vacuum, learning every lesson through trial and error. Thunderview brings them together in a monthly forum to share lessons and celebrate wins.

**The problem it solves:** CEO loneliness. Wins and losses are equally isolating — very few people understand why landing customer #10 matters.

**What makes it different:** Every attendee is vetted in advance. No service providers trolling for customers, no job-seekers. CEOs are peers, not products. Only Colorado event exclusively for CEOs of product/software companies.

**What it is NOT:** Not polished/luxury. Not a private members' club. Not startup-conference-bold. Not dark mode. Not illustration-driven. Not minimal/stark.

---

## CONTENT FUNDAMENTALS

Tone: **Empathetic and no bullshit.**

### Voice
- **Plainspoken, first person, direct.** Eric writes like he talks. Short sentences. Contractions (it's, don't, we're).
- **"We" for Thunderview, "you" for the reader.** Never "our community" fluff. "At Thunderview, we vet every CEO. You'll know who's in the room before you walk in."
- **Confident but not salesy.** No superlatives (never "best", "premier", "exclusive"), no stats cosplay ("game-changing", "10x"), no startup-conference cheerleading.
- **Humor is dry.** Occasionally self-aware. The GitHub repo name is literally `TheHubOfGitMayPolitelySuckMyAss/ThunderviewOS`. That energy, dialed back 40%, in product copy.
- **Says the quiet part.** The app's CLAUDE.md rules include "Don't validate, praise, or smooth ambiguity. Disagree when warranted." That carries into copy — we don't flatter the reader.

### Specifics
- **Casing:** Sentence case for headings. Buttons use Title Case ("Buy A Dinner Ticket", "View The Community", "Submit"). Don't shout — no ALL CAPS except for the `.tv-eyebrow` micro-label with wide tracking.
- **Oxford comma:** yes.
- **Numerals:** 10+ uses digits. "ten" reads better in prose up to nine.
- **Em-dashes** — used freely. They match the conversational voice.
- **No emoji** in product UI. Safe in private Slack; never in marketing, email, or UI. Photos do the warmth; emoji would undercut it.
- **No exclamation points** except in the apply/thanks confetti moment. Keep them rare.
- **Unicode:** straight quotes fine in code; curly quotes (' " — …) preferred in body copy and email.

### Good / not-good examples
| Good (Thunderview) | Not-good (generic SaaS) |
|---|---|
| "Monthly dinners for Colorado startup CEOs." | "Connect, learn, and grow with the premier community for Colorado founders." |
| "Every attendee is vetted. You'll know who's in the room." | "Curated, high-signal networking for today's top operators." |
| "Buy A Dinner Ticket" | "Secure Your Seat →" |
| "Last Month's Intros & Asks" | "Previous Event Recap" |
| "Thanks — we'll be in touch within a week." | "Application received! We're excited to connect with you." |
| "Sadly, this means no CTOs, CPOs, Presidents, co-founders or spouses (work or otherwise)." | "This event is for CEOs only." |

Note that last example is lifted from the real application form — it's a good yardstick for the tone.

### Body-copy lede template
> *One short declarative sentence. Then the reason it matters, in human language. Then what to do next.*

---

## VISUAL FOUNDATIONS

### Backgrounds
- **Light cream (`--bg: #FBF7F0`)** is the default page surface everywhere. Never pure white; never dark mode.
- Elevated surfaces step up to `--bg-elevated` (`#F5EEE1`) — warmer, slightly tan.
- No gradients as primary decoration. A very soft radial warm-light vignette (`.tv-paper`) gives the cream surface a candle-lit feel without looking gradient-y.
- **Texture:** a subtle noise/linen texture (SVG fractal noise at ~8% alpha, warm-tinted) applied to the `body` or hero sections. This is the "textured and handmade" feel.
- **Photography is the primary imagery.** Full-bleed on marketing hero; card-sized in portal/recap. Photos are warm, indoor, low-light — dim amber/tungsten cast, grainy, candid. Never use stock photos. Never use illustrations.

### Color
- **Warm neutrals only** for chrome: cream, tan, warm gray. See `colors_and_type.css` for tokens.
- **One accent color:** `--clay-500 #9A7A5E` (a muted warm brown; an earlier draft used `#B5835A` — the darker value is the one actually in production). Buttons, links, and key affordances. Hover darkens to `--clay-600 #76563D`.
- **Rare secondary accents** (used once per screen max): `--ember-600` (alert red), `--mustard-500` (highlight gold), `--moss-600` (success olive). Never saturated primary RGB — always pulled from dinner photography.
- **No bluish-purple gradients.** No tech-blue. No pure black.
- **Known internal inconsistency (prod):** the input/textarea/select focus glow is hardcoded to `rgba(181,131,90,0.18)` — that RGB is the previous `#B5835A` clay, not the current `#9A7A5E`. Mocks in this system use the same literal glow to match prod pixel-for-pixel. When the ring is next touched in code, it should switch to an `rgba()` derived from the current `--clay-500`.

### Typography
- **Inter** for all UI, body, and navigation. Sans-serif, clean, modern. 400/500/600/700.
- **Fraunces** (variable, opsz) for display and editorial headlines. Its soft warmth and slight quirk match the handmade feel without being decorative.
- **JetBrains Mono** for tokens and code samples in this system (rarely used in product).
- Type scale caps at 64px — hero headlines are large but not loud. Body 16px, reading-lede 18px. See `colors_and_type.css`.
- **Tracking:** slightly tight on display (-0.015em); wide on eyebrow micro-labels (+0.14em, uppercase).
- `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs.

### Borders & radii
- **Hairline borders, warm tinted** (`--line-200 #E2D7C1`). Never gray. Never black.
- **Radii:** 8px for most UI (inputs, buttons). 14px for cards. 20px for feature cards / hero units. 999px for pill tags and avatar circles.
- Corners are **rounded but not soft-toyish**. 8–14px is the sweet spot.
- **Semantic aliases only in app code.** Use `var(--border)` / `var(--tv-border)` and `var(--border-subtle)` / `var(--tv-border-subtle)`, never the raw scale `--line-100` / `--line-200`. Same rule across the system: always prefer the semantic alias over the underlying scale token. The scale values stay in `:root` as the underlying definitions but are not referenced directly in components.
- **Token prefix — how prod works.** In the production app (`src/app/globals.css`) every token is defined with a `--tv-*` prefix (e.g. `--tv-bg`, `--tv-accent`, `--tv-dur-fast`), because Tailwind 4's `@theme inline` block writes to the same CSS custom-property namespace and the prefix prevents collision. Components almost never read raw vars — they use the Tailwind utility classes the `@theme` block exposes (`bg-bg`, `text-fg1`, `border-accent`, `rounded-lg`, `shadow-glow`). This design-system file re-exposes every token under both the unprefixed name (`--bg`) and the prefixed name (`--tv-bg`) so mocks here can use either. Either is valid.

### Shadows
- Warm-tinted (brown/amber cast, not gray). See `--shadow-sm/md/lg` in tokens.
- **Candle-glow shadow** (`--shadow-glow`) — soft clay-colored outer glow for the one feature card per screen.
- Inner shadows are rare; used only on pressed input states (`inset 0 1px 2px rgba(75,54,33,0.08)`).

### Cards
- Cream surface (`--bg-elevated`) + 1px warm border (`--border`) + 14px radius + `--shadow-sm`.
- Inner padding: 24–32px (`--space-5` to `--space-6`).
- **Feature card:** add `--shadow-glow` for candle warmth.
- **Photo card:** photo fills top 60%, text lives in warm cream band below. Never hard-clip a photo to a square unless you must — prefer 3:2 or 4:5.

### Animation
- **Fades and slow crossfades.** No bounces, no overshoots, no springs. Dinners are calm — the UI should be too.
- Durations: `--dur-fast: 120ms` (hover), `--dur-med: 220ms` (state change), `--dur-slow: 420ms` (page transitions, photo crossfade).
- Easing: `cubic-bezier(.2, .7, .2, 1)` for enters, `cubic-bezier(.5, 0, .2, 1)` for leaves.
- Scroll-triggered: slight upward translate (8px) + opacity crossfade, never a dramatic reveal.
- **Motion tokens** are available as both `--dur-fast` / `--dur-med` / `--dur-slow` / `--ease-out` / `--ease-in-out` and their prefixed twins `--tv-dur-fast` / `--tv-dur-med` / `--tv-dur-slow` / `--tv-ease-out` / `--tv-ease-in-out`. Production code uses the `--tv-*` form. Both are valid.

### Hover / press states
- **Hover on links:** underline appears (text-decoration: underline), color unchanged.
- **Hover on buttons (primary):** background darkens one step (clay-500 → clay-600), ~8% darker. Never a glow, never a scale.
- **Hover on buttons (secondary):** background fills in from transparent to `--bg-tinted`.
- **Hover on cards:** shadow lifts one step (sm → md), border tint stays.
- **Press:** scale `0.98` over 80ms; release returns over 160ms. Subtle.
- **Focus ring — TWO treatments in prod, by component family:**
  - **Buttons:** `outline: 2px solid var(--clay-500); outline-offset: 2px;` (only on `:focus-visible`). No box-shadow.
  - **Inputs, textareas, selects:** `border-color: var(--accent)` + `box-shadow: 0 0 0 3px rgba(181,131,90,0.18)` (a 3px clay glow). No outline.
  Both are always visible and never removed. If you add a new interactive primitive, pick the treatment that matches its family (button-like → outline; field-like → glow).

### Transparency & blur
- **Transparency used sparingly.** Dim sticky nav uses `rgba(251,247,240,0.86)` + `backdrop-filter: blur(10px)` when photos are behind it. Otherwise solid.
- **No glassmorphism cards.** One glass element per screen max (the sticky nav), never stacked.

### Imagery character
- **Warm color cast** — tungsten/amber lighting, low-key. Candid, faces mid-laugh, no posed portraits. Shallow depth of field.
- **Grain is welcome.** Don't denoise photos to perfection; the slight noise is the point.
- **Never desaturate.** Never convert to B&W. Never apply a duotone filter — that's a "private club" aesthetic and we're not that.
- **People, plural.** Solo portraits rarely. Two-plus people conversing is the hero frame.

### Layout rules
High-level layout direction. For the exact token values every component must use, see **LAYOUT INVARIANTS** below.

- **Max content width:** 1040px marketing, 1280px portal, 1440px admin. Use `.tv-container-marketing` / `.tv-container-app` / `.tv-container-admin`. Known drift: `src/app/page.tsx` in production hardcodes `max-w-[1120px]` on the marketing hero instead of consuming the token — should be migrated to `.tv-container-marketing` (or the token raised to 1120px) to stop hand-tuned widths from spreading.
- **Gutters:** 24px mobile, 48px desktop. Use `.tv-page-gutter`. Content feels roomy — this is a dinner, not a conference.
- **Sticky top nav** (see `ui_kits/portal` and `ui_kits/marketing`); no sticky footers. All navs are 64px tall — use `.tv-nav`.
- **Grid:** 12-col with 24px gutter on marketing; 2-col stack on portal; table rows on admin.
- **Density:** moderate. Admin is denser (tables) but still padded generously compared to typical dashboards.

### Iconography
See `README.md → ICONOGRAPHY` below.

---

## LAYOUT INVARIANTS

> These values are non-negotiable. If a new design needs to deviate, update the token in `colors_and_type.css` — do not hand-tune a component. The goal is that any new page added in six months matches the existing pages without a designer re-specifying spacing.

### Navigation
- **All top navigation is exactly `var(--nav-height)` (64px) tall.** Applies to public-nav, portal top-nav, and any future authenticated chrome. Use the `.tv-nav` utility.
- **Logo:** `var(--nav-logo-size)` (20px) Fraunces 500 with -0.01em tracking. Use `.tv-nav-logo`. Same size across every nav.
- **Nav link gap:** `var(--nav-link-gap)` (24px) between nav links.
- **Logo → link group gap:** `var(--nav-logo-to-links-gap)` (48px).

### Page chrome
- **Page gutters:** `var(--page-gutter-sm)` (24px) mobile, `var(--page-gutter-lg)` (48px) desktop. Apply via `.tv-page-gutter` or equivalent. Never hand-tune `px-6`, `px-7`, `px-10`.
- **Container widths:** marketing 1040px, app (portal) 1280px, admin 1440px. Use `.tv-container-marketing`, `.tv-container-app`, `.tv-container-admin`.

### Vertical rhythm
- **`--section-gap` (64px)** between major page sections.
- **`--stack-gap` (24px)** inside a section, default vertical rhythm.
- **`--tight-gap` (12px)** for related items.
- **Page header block** (eyebrow + H1 + lede) uses `.tv-page-header`. Items inside stack at `--tight-gap`; the block itself is followed by `--section-gap` before the next section.

### Forms
- **Fields stack at `--form-row-gap`** (16px).
- **Label to input** is `--label-input-gap` (8px).
- **Button groups** use `--button-group-gap` (12px).

### Tables
- **Rows** are `--table-row-height` (52px).
- **Headers** are `--table-header-height` (44px).
- **Cells** are horizontally padded at `--table-cell-padding-x` (16px).

### Modals
- **Small** 420px, **medium** 560px, **large** 720px. Use `--modal-width-*`.

---

## COMPONENTS

General rules that apply to every component primitive. For surface-specific component details, see each `ui_kits/*/README.md`. The list below is the canonical set shipped in `src/components/ui/` and `src/components/`:

| Primitive | File | Purpose |
|---|---|---|
| `Button` | `ui/button.tsx` | Primary / secondary / ghost. `asChild` for Link-as-button. Sizes sm/md/lg. |
| `Card` | `ui/card.tsx` | Variants: default, elevated, feature (candle-glow), photo. 20px inner padding. |
| `Input` | `ui/input.tsx` | Text input. `error` flag toggles ember border. |
| `Textarea` | `ui/textarea.tsx` | Multi-line. Min-height 90px, resize-y. |
| `Select` | `ui/select.tsx` | Native `<select>` with Lucide chevron-down overlay (pointer-events-none). |
| `Label` | `ui/label.tsx` | Form label, 13px, fg2. `required` flag renders a clay asterisk. |
| `FieldHelp` | `ui/field-help.tsx` | Helper text under inputs; `error` flag switches to ember. |
| `Pill` | `ui/pill.tsx` | Variants: stage, neutral, accent, success, warn, danger. Optional leading `dot`. |
| `Avatar` | `ui/avatar.tsx` (re-export) → `member-avatar.tsx` | Member avatar; falls back to initials in clay circle. |
| `Eyebrow` / `H1` / `H2` / `H3` / `H4` / `Lede` / `Body` / `Small` | `ui/typography.tsx` | Semantic type, each maps to a `.tv-*` class. |
| `TopNav` | `top-nav.tsx` | Authenticated nav (portal + admin). Logo → `/portal`, center links, avatar dropdown. |
| `PublicNav` | `public-nav.tsx` | Marketing nav. About / FAQ / Team / Gallery + Apply + Sign In/Portal. Blurred over photos. |

### Button sizes (prod)
- `sm` — 13px text, 3.5×7 padding (approx 14×7 px)
- `md` — 14px text, 5×11 padding (default)
- `lg` — 15px text, 26×14 padding
All three share the same 8px radius (`--radius-md`), 120ms transition, and `scale(0.98)` active press.

### Avatar sizes (prod)
- `sm` — 28px (table rows, inline)
- `md` — 40px (nav dropdown trigger is 36px, closest to this tier)
- `lg` — 120px (profile hero)
Fallback: initials (`FirstInitial + LastInitial`) in a solid `--clay-500` circle, cream text, medium weight.

### Pill variants (prod)
- `stage` (default) — cream-elevated surface, ink-700 text, 1px border. **Note:** the VISUAL FOUNDATIONS section used to describe the stage pill as tan-filled; that's the `accent` variant. Default stage pills are outlined cream.
- `neutral` — tinted cream surface, ink-900 text, no border.
- `accent` — tan-300 surface, ink-900 text. Use for the "new member" / highlight.
- `success` / `warn` / `danger` — pale tinted surface + matching foreground + optional dot.

### Nav logo wordmark
Both `PublicNav` and `TopNav` render the word **"Thunderview"** (no "OS" suffix, no descender flourish). Earlier docs said "Thunderview OS" — that is wrong; prod is just "Thunderview". Logo size, weight, and tracking are locked by `.tv-nav-logo`.

### Buttons-as-links

**Anything that looks like a button must use the `Button` primitive.** No anchor-styled-as-button. If a `<Link>` needs button visuals, wrap it:

```tsx
<Button asChild>
  <Link href="/apply">Apply To Join</Link>
</Button>
```

This prevents per-file reinvention of padding, focus ring, press animation, and hover behavior. Same rule for external links and form-submit buttons: always the primitive.

### Primitive scope

Every component in `src/components/ui/` composes tokens from `colors_and_type.css` and the layout invariants above. If you find yourself writing inline padding or custom focus ring CSS on a specific usage, stop — the primitive is wrong, not the usage.

---

## ICONOGRAPHY

**Approach:** minimal line icons, only where they add meaning. Thunderview is photo-first; icons are never decorative.

- **Icon set: Lucide** (`lucide.dev`) — thin 1.5px stroke, rounded joins, 24px default grid. It matches the warm, unfussy character of the brand. Not copied into `assets/` — linked from the Lucide CDN in prototypes. In production, the codebase should install `lucide-react`.
- **FLAG — substitution:** the current codebase has no icons at all (stock Next.js boilerplate). Lucide is our recommendation; we have not confirmed with Eric that this is the chosen set. If he wants a different one (Heroicons, Phosphor, custom), flag and swap.
- **No emoji** in product surfaces. No unicode pictograms (no ☆, no →-as-nav, no ✓ for success). Lucide `check`, `arrow-right`, `star` instead.
- **SVG logos:** wordmark + monogram live in `assets/logo/` (see files). Hand-tuned, not Lucide. They carry the warmth — slight letter-spacing tweaks, Fraunces-derived terminals.
- **Avatars:** when no profile pic, solid `--clay-500` circle with member initials in cream text (400-weight Inter). No cartoon avatars, no generated gradients, no AI-generated faces.
- **Stage-type badges:** default `stage` pill variant = `--bg-elevated` surface + `--ink-700` text + 1px `--border`. For an emphasized "accent" tag (e.g. "new member"), use the `accent` pill variant = `--bg-accent` (tan-300) + `--ink-900` text. No icon either way — copy carries the meaning.

Icon sizing: 16px inline with text (buttons), 20px for nav, 24px for standalone (empty-state, feature cards).

---

## How to use this system

Load `colors_and_type.css` into any HTML artifact. For React prototypes, the UI kits export small JSX components — see each `ui_kits/*/README.md`.

If you're building production code for the real `thunderview-os` repo, the mapping is:
- **CSS vars** in `colors_and_type.css` → add to `src/app/globals.css` and expose via `@theme inline` for Tailwind 4.
- **Fonts** → swap `Geist`/`Geist_Mono` in `src/app/layout.tsx` for `Inter` and `Fraunces` from `next/font/google`.
- **Components** → treat `ui_kits/*/*.jsx` as visual specs, not drop-in. Re-implement inside the real app with real Supabase wiring.

### Portal back-link convention

Pages in the top nav (Home, Tickets, Community, Recap) show no back link — the sticky top nav is how you move between them. Pages not in the top nav (Members/[id], Profile edit) show a back link to their logical parent (Community or Portal home respectively). See `ui_kits/portal/index.html` for reference.

### Known hazard: Tailwind 4 `--spacing-*` collision

Tailwind 4 computes numeric spacing utilities (`h-9`, `p-4`, `gap-6`) as `calc(var(--spacing) * N)` from a single base variable. If you define `--spacing-9` in `@theme inline`, Tailwind treats it as a named override for that step — so `h-9` resolves to your value, not `0.25rem * 9`. Our spacing scale is non-linear (e.g. `--tv-space-9 = 96px`), so this silently breaks every numeric utility that happens to hit an overridden step. Only semantic aliases (`--spacing-stack`, `--spacing-section`, etc.) belong in `@theme inline`. See `colors_and_type.css` header and `ui_kits/system/index.html` §01 for details.
