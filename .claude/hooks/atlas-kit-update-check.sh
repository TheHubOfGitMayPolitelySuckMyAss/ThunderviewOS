#!/usr/bin/env bash
# Atlas kit update check — SessionStart hook, ships with the kit.
#
# Once per 24h of activity per repo, compare the installed kit SHA (stamped
# in .claude/atlas-kit.json at install/update time) against the kit origin's
# HEAD via git ls-remote (no clone, no working-tree touch). On drift, emit a
# one-line nudge into session context; the agent runs /kit-update, which is
# the reviewable ritual — this hook NEVER writes files itself, so a kit bug
# can't silently propagate to every install overnight.
#
# Silent exits by design: no stamp file (this repo IS the origin, or the kit
# isn't installed), offline / no credentials (next day's check retries).

ROOT="${CLAUDE_PROJECT_DIR:-.}"
STAMP="$ROOT/.claude/atlas-kit.json"
[ -f "$STAMP" ] || exit 0

KEY=$(echo "$ROOT" | md5 -q 2>/dev/null || echo "$ROOT" | md5sum | cut -d' ' -f1)
DEBOUNCE="/tmp/claude-atlas-kit-check-$KEY"
now=$(date +%s)
last=$(cat "$DEBOUNCE" 2>/dev/null || echo 0)
[ $((now - last)) -lt 86400 ] && exit 0
echo "$now" > "$DEBOUNCE"

origin=$(sed -n 's/.*"origin": *"\([^"]*\)".*/\1/p' "$STAMP")
installed=$(sed -n 's/.*"sha": *"\([^"]*\)".*/\1/p' "$STAMP")
[ -n "$origin" ] && [ -n "$installed" ] || exit 0

latest=$(git ls-remote "$origin" HEAD 2>/dev/null | cut -f1)
[ -n "$latest" ] || exit 0
[ "$latest" = "$installed" ] && exit 0

echo "Atlas kit update available: installed ${installed:0:7} → latest ${latest:0:7} at $origin. Run /kit-update to review and apply."
exit 0
