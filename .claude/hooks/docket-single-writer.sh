#!/usr/bin/env bash
# Docket single-writer guard — docs/docket.md is edited on the default branch
# ONLY. A state file with N concurrent writers (worktrees) accretes
# contradictions: each session truthfully updates its copy, every other copy
# goes stale, and merges keep both sides because neither is wrong (Eric,
# 2026-07-22, after the KQ docket rotted to 780 lines). Branch sessions file
# one-note-per-file updates in docs/docket-inbox/ instead — conflict-free by
# construction; the session that merges to the default branch folds the inbox
# (sweep skill, docket step).
#
# PreToolUse on Edit|Write. exit 2 blocks the call and shows stderr to the
# agent. The branch is read from the TARGET FILE's checkout, not the session's
# project dir — a worktree session editing the primary checkout's docket on
# its default branch is the single-writer path working, not a violation.

INPUT=$(cat 2>/dev/null)
FILE=$(echo "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
case "$FILE" in
  */docs/docket.md | docs/docket.md) ;;
  *) exit 0 ;;
esac

DIR=$(dirname "$FILE")
[ -d "$DIR" ] || DIR="${CLAUDE_PROJECT_DIR:-.}"
BRANCH=$(git -C "$DIR" branch --show-current 2>/dev/null)
[ -z "$BRANCH" ] && exit 0 # detached HEAD / not a repo — not an editing session
DEFAULT=$(git -C "$DIR" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
DEFAULT="${DEFAULT:-main}"
[ "$BRANCH" = "$DEFAULT" ] && exit 0

cat >&2 <<MSG
BLOCKED: docs/docket.md is single-writer — edited on '$DEFAULT' only; this checkout is on '$BRANCH'.
File the update as a note instead: docs/docket-inbox/<short-slug>.md (one note per item), stating
the docket item, its new state (in-flight/open/done), its ON ERIC / ON AGENT / BLOCKED ask line,
and pointers (decisions §, atlas node, commit). The session that merges to '$DEFAULT' folds the
inbox into the docket and deletes the notes (sweep skill, docket step).
MSG
exit 2
