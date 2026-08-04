---
name: sweep
description: Session-close ritual — run the atlas open-loop sweep plus the handoff layers (docket, memory, uncommitted work) so the session can be closed or /clear-ed at any moment with nothing lost. Use when the user says /sweep, "write the handoff", or signals they're about to close the session.
---

# /sweep — close the session with nothing in your head

The 45-minute Stop hook (`.claude/hooks/atlas-open-loop-sweep.sh`) owns the
*periodic* ask; this skill is the *on-demand* superset for session close. The
promise: after a clean sweep, Memories + Atlas + repo docs fully reconstruct
this session's context — the terminal window holds nothing.

Review the whole conversation since the last sweep (hook-fired or manual) and
work the layers in order. Each layer names its store; file to the RIGHT one —
duplicating across stores is as bad as dropping.

The sweep is a DIFF, not a re-audit: filings, resolutions, and Decisions
appends already made during the session count — never re-file or re-confirm
them. And it runs on a budget: the atlas layer (1) is ~2 minutes cold, end to
end. Plumbing time — hunting for where notes live, guessing schemas,
re-deriving connections — is failure, not thoroughness; the storage contract
is pinned (below) precisely so none of it recurs.

## 0. One sweep at a time (the lock)

Two simultaneous sweeps in one checkout write the same shared stores (docket,
git index, memory); the loser commits the winner's half-written state. Before
touching anything, acquire the lock:

```bash
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
KEY=$(echo "$ROOT" | md5 -q 2>/dev/null || echo "$ROOT" | md5sum | cut -d' ' -f1)
LOCK="/tmp/claude-atlas-sweep-lock-$KEY"
now=$(date +%s)
if [ -f "$LOCK" ] && [ $((now - $(cat "$LOCK"))) -lt 1800 ]; then
  echo "LOCKED: another sweep started $(( (now - $(cat "$LOCK")) / 60 ))m ago"
else
  echo "$now" > "$LOCK" && echo "lock acquired"
fi
```

- **LOCKED** (fresh, <30 min): another session is mid-sweep. Stop gracefully —
  tell the owner which repo is locked and since when, do NOT proceed to any
  layer, and suggest re-running /sweep when the other session's receipt lands.
- **Stale** (≥30 min): a sweep that died without releasing. Take the lock and
  proceed, noting the takeover in the receipt.

The lock is released in step 5, alongside the debounce stamp.

## 1. Atlas sweep (same checklist the hook fires)

- **Open loops** — decisions pending on the owner, questions he must answer,
  ideas raised and dropped: file each to ONE store, never both.
  Feature-anchored → the node's todo inbox as source='extracted', via the
  write route pinned in `docs/atlas/notes-adapter.md`. A repo without that
  file runs no inbox and files open loops to the docket instead. Cross-cutting or
  initiative-level → the docket "Open — Unanswered" INSTEAD, with at most a
  pointer from the note side; a note that restates a docket entry's status
  is the N-writers disease the docket rules exist to kill, and the notes
  contract test hunts "also in docket" phrasing.
- **Decisions made** — anything ruled this session that changed a feature:
  confirm the owning node's Decisions got its append (same-commit rule); a
  reframe of Why/What is a decision too (convention rule 5).
- **Todos triage** — LIST-DRIVEN, never memory-scoped: read
  `docs/atlas/notes-adapter.md` and run its pinned open-notes query VERBATIM
  via its named connection route — never re-derive the table, columns, or
  connection (if the contract has drifted from reality, fixing that file is
  itself a sweep finding, same commit as whatever moved). No
  `notes-adapter.md` → no inbox → this bullet is a no-op. Disposition every
  note that (a) anchors to a node whose feature was touched since the last
  sweep, or (b) is near or past the freshness budget (pinned in the same
  file; check `verified_at`). Disposition
  = resolve (`done` if acted on — promote the durable residue into the node;
  `good_as_is` if reviewed and nothing owed) or re-affirm against CURRENT
  evidence — read the code/doc the note makes claims about, then bump
  `verified_at`. Never re-affirm from memory: the session that ships a
  note's subject is usually not the one that filed it, and only the queried
  list catches those. The receipt carries the count line:
  "todos: N→M open (X resolved, Y re-affirmed, Z filed)". An over-budget
  list blocks the safe-to-close verdict exactly like a red docket.

## 2. Docket handoff — fold, prune, then update

The docket is SINGLE-WRITER: `docs/docket.md` is edited on the default branch
only (hook-enforced). On a branch/worktree, every docket-shaped update below
becomes a note file in `docs/docket-inbox/<slug>.md` instead — one note per
item: the item, its new state, its ask line, pointers.

On the default branch, in order:

- **Fold the inbox** — apply each `docs/docket-inbox/*.md` note to the
  docket, then delete the note. The inbox must be empty after a sweep.
- **Prune** — any entry whose work shipped/settled this session MOVES to
  Done as a one-liner (never a SHIPPED stamp left in place); surviving
  entries keep their `**ON <owner>:**` / `**ON AGENT:**` / `**BLOCKED:**`
  first line current, ≤12 lines, history as pointers.
- **Update** — every In Flight item touched this session reflects its
  CURRENT state and concrete next step. Genuinely mid-task work gets a
  handoff note on its item: where it stands, what's next, any live reasoning
  a fresh session could not reconstruct from files. External state the repo
  can't confirm gets the ⚠unverified tag.
- **Run the docket contract test** (if the host has one — seeded from
  `templates/docket-contract.test.ts`). A red docket blocks the safe-to-close
  verdict exactly like an unfiled item.

## 3. Memory

- **Volatile state** (statuses, blockers, dated plans, "X not yet done"):
  update the project-state memory file; convert relative dates to absolute.
- **User/feedback facts** learned this session (preferences, corrections,
  how-to-work guidance): own memory file + MEMORY.md index line.
- **Stale entries**: anything this session proved wrong or overtook — update
  or delete. A memory that graduated into decisions.md/atlas becomes a
  pointer, not a copy.

## 4. Repo state

- `git status` — every uncommitted change is either committed now (with its
  same-commit atlas/docket updates) or filed as a **docket entry** with an
  owner prefix, naming the paths and what unblocks them. Nothing dangles
  silently.
- **Saying it in the receipt is NOT filing it.** The receipt is chat; chat is
  not a store. "Intentionally uncommitted" is only a real disposition when a
  docket line exists, because the next session reads the docket and never
  reads this conversation. A sweep once listed four dirty paths in its receipt,
  wrote "already applied" in the docket, and declared safe-to-close; the work
  sat uncommitted for two days and was then swept into an unrelated commit by
  a `git add -A`. The docket said done, the tree said otherwise, and only the
  chat knew.
- **Do not emit the verdict over a dirty tree** unless every dirty path was
  committed this sweep or appears in a docket entry written this sweep. Dirty
  files with neither are an unfiled item, and the verdict rule below applies.
- **Shared-checkout guard:** before committing a shared doc (docket, atlas
  nodes, README), `git diff` it and check whether its dirty content is YOURS.
  Another session's mid-flight edits → leave the file uncommitted and name it
  in the receipt. A foreign handoff that is clearly finished and marked
  keep-regardless may ride along — named in the commit message, never
  silently.

## 5. The closing question, then the receipt

Ask literally: **"Is there anything in this conversation a fresh session
could not reconstruct from files?"** If yes, it goes to the docket (open
work), decisions.md (a ruling), or memory (state/preference) — then re-ask.

Reset the hook's debounce stamp and release the sweep lock:

```bash
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
# Debounce stamp is keyed per repo + SESSION (matches the hook); the lock
# stays repo-only (step 0) — do not conflate the two keys.
SID="${CLAUDE_CODE_SESSION_ID:-nosession}"
STAMPKEY=$(echo "$ROOT|$SID" | md5 -q 2>/dev/null || echo "$ROOT|$SID" | md5sum | cut -d' ' -f1)
LOCKKEY=$(echo "$ROOT" | md5 -q 2>/dev/null || echo "$ROOT" | md5sum | cut -d' ' -f1)
date +%s > "/tmp/claude-atlas-sweep-$STAMPKEY"   # debounce stamp
rm -f "/tmp/claude-atlas-sweep-lock-$LOCKKEY"    # release the lock (step 0)
```

Close with a one-screen receipt: what was filed where (or "clear" per layer),
ending with the verdict line — **"Sweep complete — safe to close."** Never
emit the verdict while any layer has an unfiled item.
