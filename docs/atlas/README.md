<!-- Instantiated from atlas-kit templates/atlas-README.md 2026-08-04.
     Localized sections adapted for ThunderviewOS; everything else tracks
     the kit origin (see .claude/atlas-kit.json). -->

# Atlas — the project's living map

**What this is.** A fractal, just-in-time map of every functional feature in this
project: why it exists, what it does, how it currently works, every decision that
shaped it (including reversals), and the ideas that were considered and killed.
It exists because AI-assisted building removes the cost of *creating* systems but
not the cost of *remembering* them — the management tax.

**Files-first.** The atlas is these markdown files; they are the product, not a
build input. A renderer is optional per host, and nothing here depends on one.
The map versions with the territory, shipping with the commits that change it.
Humans read the map one bounded screen at a time; agents read the files before
touching anything.

**The core rule: bounded levels, unbounded depth.** The total corpus may grow
forever; every individual screen may not. A card is two sentences. A node's How
fits on one screen. When a node outgrows its budget, split it into child nodes —
never let it sprawl in place.

## Structure

```
docs/atlas/<domain>/_domain.md          domain node (the top-level card)
docs/atlas/<domain>/<feature>.md        feature node
docs/atlas/<domain>/<feature>/<sub>.md  sub-feature node (when a feature outgrows)
```

Directory tree = feature tree. A feature with children keeps its own `.md` file
as the parent node AND gains a directory of the same name for children.

## Node format

```markdown
---
title: Stint-level embeddings
why: One or two sentences — WHY does this exist. The problem, not the mechanism.
what: One or two sentences — WHAT does success look like. Never a restatement of the mechanism (that's How's job). Locked at every level, domain and feature.
status: live            # live | parked | deprecated
---

## How

HOW do we do the work: current mechanics, present tense, rewritten IN PLACE
when behavior changes. Budget: one screen (~40 lines).

**Audience: the OWNER, not the agent.** The owner reads How to answer "how
does this work, again?" without having to ask — then checks Decisions to see
if a change he's considering retreads settled ground. So: plain language, his
vocabulary; what triggers it, what it does, what comes out; parameters with
their knob names. Code pointers are parenthetical anchors
`(lib/embeddings/embed.ts)`, never the spine of a sentence. Agents don't need
How for mechanics — they read the code, which is authoritative; nodes give them
the intent and history that code can't carry (Why/What/Decisions/Graveyard).

## Decisions

Append-only, newest last. Each entry: date, the decision, the why, an anchor
(SHA / migration / deep-dive-doc §). Reversals reference the entry they reverse.

- **2026-07-09** — Person-level embeddings replaced by stint-level; a perfect
  hit was buried at ~#500 by career dilution. (§1)

## Graveyard

Ideas considered and rejected, with the why. This is the anti-relitigation
section — check it before proposing something clever.

- **One vector per person** — buried a perfect hit at ~#500. Do not rebuild
  without new evidence. (§1)
```

**Parameters never appear in Why or What.** Tunable values (windows, thresholds,
cadences, caps) drift; principles don't. Why/What state the principle ("under the
result cap", "at the account's measured limits"); How carries the current value
WITH its knob name (`HARD_CAP=40`) so a knob change is one grep away from every
node that mentions it. Historical facts (incident dates, quoted anecdotes) are
immutable and exempt. Verbatim quotes containing parameters are how staleness
sneaks in — trim to the principle or date the quote.

## Maintenance contract

1. **Same-commit rule.** A commit that changes a feature's behavior updates that
   feature's node (How rewritten, Decisions appended) in the same commit.
2. **Decisions are append-only.** Never edit history; append the reversal.
3. **Graveyard before proposal.** Re-opening a buried idea requires arguing
   against the recorded reason, not from scratch.
4. **Split at the budget.** How > ~40 lines → extract child nodes.
5. **A Why/What change is a REFRAME, and a reframe is a decision.** The card
   always shows current truth — edit Why/What freely — but the old framing is
   memorialized as a Decisions entry in the same commit ("Reframed: was X, now
   Y, because Z"). The purpose may change; the fact that it changed may not be
   erased.
6. **Restructures conserve history.** When features split, merge, or get
   replaced, nodes follow the code's lifecycle under the same-commit rule —
   but Decisions/Graveyard entries MOVE to the successor node, never vanish.
   A killed feature's node flips to `deprecated` as a tombstone while its code
   exists; when the code is deleted, the node's residue moves to the domain's
   Graveyard.
7. **Deep-dive decision histories stay where they are** (this repo keeps none
   in-repo — the canonical product spec is the v4 handoff doc, which lives in
   Eric's chat sessions outside the repo; CLAUDE.md is the agent operating
   doc, not a decision archive); nodes carry the feature-scoped decisions
   citing them and link them for archaeology; never duplicate wholesale.
8. **Provenance receipts.** Any owner-attribution — a tag like "(Owner)" /
   "(Owner, 7/19: …)" or prose like "Owner ruled …" — is inadmissible without
   a receipt IN THE SAME bullet: the owner's verbatim words in quotes plus a
   date. The quote must be greppable in session transcripts; that is the
   receipt. Paraphrase wears the owner's name only with their words beside
   it. Enforced by the provenance-receipts block in the atlas contract test
   (`OWNER_NAME` here: Eric; no JS test runner in this repo yet, so the rule
   is manually enforced until one exists). Born 2026-07-22 in the KQ repo: a 7/20
   audit found 3 of 17 owner-attributions had no receipt — one doctrine the
   owner never stated wore his name for days.

The open work docket is the atlas's sibling: `docs/docket.md` — three states
(In Flight / Open–Unanswered / Done), same same-commit maintenance rule, plus
four rules of its own (it is STATE, not a log — learned when a docket rotted
to 780 lines of shipped-but-still-In-Flight entries):

1. **Single-writer.** Edited on the default branch only, enforced by the
   `docket-single-writer.sh` PreToolUse hook. Branch/worktree sessions file
   one-note-per-file updates in `docs/docket-inbox/` (conflict-free by
   construction); the session that merges folds the inbox and deletes the
   notes (sweep skill, docket step).
2. **Ask-first entries.** Every In Flight / Open entry's first line is
   `**ON <OWNER>:**` / `**ON AGENT:**` / `**BLOCKED:**` + a one-line ask;
   owner entries sort first — the owner's queue is the top of the page.
3. **Short entries.** ≤12 lines open / ≤10 done; history is pointers
   (decision doc §, atlas node, commit sha), never inline prose.
4. **Done things MOVE.** A state change relocates the entry to Done as a
   one-liner — a SHIPPED/RESOLVED stamp left on an open entry fails CI.

All four are enforced by the docket contract test (seed from
`templates/docket-contract.test.ts`, sibling of the atlas contract test).

## Todos — the capture inbox (pluggable)

**This repo runs with NO inbox** — it has no `docs/atlas/notes-adapter.md`,
and open loops go straight to `docs/docket.md`.

**The storage contract is pinned, not remembered.** A repo that runs an inbox
carries `docs/atlas/notes-adapter.md` (seed from `templates/notes-adapter.md`):
store, columns, the canonical open-notes query, the connection route, write
routes, freshness budget. Every sweep reads that file and runs the pinned
query verbatim — plumbing is never re-derived, so a sweep runs cold in ~2
minutes. When the schema moves, the contract file moves in the same commit.
A repo with NO inbox simply has no `notes-adapter.md` — its absence is the
signal (checked by the sweep hook), and open loops go to the docket instead;
that is a valid configuration.

The convention reserves a mutable **Todos** queue per node: raw thoughts and
open loops, source-tagged (`manual` vs `extracted`), that are **larval
decisions, not truths** — so unlike everything else in the atlas they belong in
a mutable inbox behind an adapter, not in these files. When a todo is acted on,
the durable residue is promoted into the node's Decisions/Graveyard in the same
commit; resolved rows are just the receipt trail. Cross-cutting open questions
still go to `docs/docket.md` (Open — Unanswered) — node todos are for thoughts
anchored to one feature.

The inbox is STATE, not a log, and it rots the same way a docket does —
learned when a 4-day-old install was found holding 41 open notes, 26 of them
already shipped, superseded, or docket dups — its ad-hoc resolutions never
queried the list and couldn't keep pace: write pressure without list-driven
resolve pressure turns the inbox into a midden. Three rules, each with an
enforcement point:

1. **Freshness contract.** Every open note carries a `verified_at` stamp
   (set on file, bumped on re-affirmation). An open note is a claim that
   re-earns its place: within the freshness budget — **14 days** here —
   it must be resolved (`done` / `good_as_is`) or re-affirmed against
   CURRENT evidence (query the code/docs, not memory, then bump
   `verified_at`). The notes contract test (seed from
   `templates/notes-contract.test.ts`) fails naming every over-budget note;
   it skips only where the host's inbox is unreachable (e.g. credential-less
   CI) — local runs are the tripwire.
2. **List-driven triage.** Resolution is never memory-scoped. The sweep
   (hook ask + `/sweep` skill) QUERIES the open list — via the query pinned
   in `notes-adapter.md`, never re-derived — and dispositions every note
   anchored to a node touched since the last sweep, plus every note near or
   past budget. "Anything shipped this session" is banned phrasing — the
   session that ships a note's subject is usually not the session that
   filed it.
3. **No double-filing.** A fact has one writer. Cross-cutting/initiative
   items live in the docket ONLY; a node note may point at a docket entry
   but never restate its status ("Also in docket" is the N-writers disease
   that rots dockets, wearing a different hat). Corollary to the same-commit
   rule: a commit that updates a node's Decisions/Graveyard dispositions
   that node's open notes in the same session — they are the larval form of
   exactly that residue.

## The kit — what "installing the atlas" means

The atlas travels as a small set of files, canonical in the **kit origin
repo** (URL + installed SHA in `.claude/atlas-kit.json`).
Installing it in a new repo = point an agent at the origin and ask for the
kit:

1. `docs/atlas/README.md` — this convention (instantiated from
   `templates/atlas-README.md`; LOCALIZE-marked sections adapted). The only
   required reading.
2. `docs/docket.md` — seeded with the three empty states (from
   `templates/docket.md`, which carries the four docket rules), plus
   `.claude/hooks/docket-single-writer.sh` + its PreToolUse entry in
   `.claude/settings.json` (the single-writer guard) and a docket contract
   test (seed from `templates/docket-contract.test.ts`).
3. `.claude/hooks/atlas-open-loop-sweep.sh` + its Stop entry in
   `.claude/settings.json` — the debounced periodic sweep ask.
4. `.claude/skills/sweep/SKILL.md` — `/sweep`, the on-demand session-close
   ritual; supersets the hook so a session is closeable at any moment.
5. `.claude/skills/rebrief/SKILL.md` — `/rebrief <topic>`, the sweep's
   read-side twin: composes a one-screen re-entry brief (first move first)
   from the node, the inbox, the docket, and git, so paused work restarts
   productive. Read-only by contract.
6. `.claude/hooks/atlas-kit-update-check.sh` + its SessionStart entry +
   `.claude/atlas-kit.json` (origin URL + installed SHA) — the daily drift
   check against the origin. Detect-only; it never writes files.
7. `.claude/skills/kit-update/SKILL.md` — `/kit-update`, the reviewable
   update ritual: byte-identical portable files copied, localized files
   reconciled by judgment, stamp advanced, one commit.
8. An atlas-contract test enforcing the node format in CI (seed from
   `templates/atlas-contract.test.ts`, adapt to the host's runner).
9. Host-specific and optional: a renderer and a todos capture inbox behind
   an adapter (Todos section above). A repo can run with neither — open
   loops go to the docket until an inbox exists. A repo that HAS an inbox
   also seeds BOTH `docs/atlas/notes-adapter.md` (from
   `templates/notes-adapter.md` — the pinned storage contract every sweep
   queries by) and the notes contract test (from
   `templates/notes-contract.test.ts`) — an inbox without its freshness
   tripwire is how 41-note middens happen, and one without its pinned
   contract taxes every sweep with re-derived plumbing.

Hooks and skills are byte-identical across installs by design; what localizes
is this README's marked sections, the contract test's runner, and the
renderer. Seed the first domain nodes from the code, then the maintenance
contract takes over. Local improvements to portable files go UPSTREAM to the
origin (see `/kit-update` §4), never fork silently.
