#!/usr/bin/env bash
# Prints what an orchestrator needs to pick the work up cold: where v3 is, what merged last,
# which arc branches are not merged, which worktrees exist, which sessions are running.
set -uo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
echo "== v3 tip"; git log -1 --format='%h %s (%cd)' --date=short v3
echo "== last merges"; git log --merges -8 --format='%h %s' v3
echo "== arc branches not merged into v3 (each must be explained in STATUS.md)"
git branch --no-merged v3 --format='%(refname:short)' | grep '^arc/' || echo "(none)"
echo "== worktrees"; git worktree list | sed "s#$HOME/##"
echo "== running outside-agent sessions"; pgrep -fl "codex exec" | cut -c1-120 || echo "(none)"
echo "== running test processes"; pgrep -fl "node --test" | cut -c1-100 || echo "(none)"
echo "== uncommitted changes in worktrees"
git worktree list --porcelain | awk '/^worktree /{print $2}' | while read -r w; do n=$(git -C "$w" status --short 2>/dev/null | wc -l | tr -d ' '); [ "$n" != "0" ] && echo "$w: $n files"; done
echo "== newest backup"; ls -t "${BACKUP_DIR:-$root/../momentum-backups}"/*.bundle 2>/dev/null | head -1 || true
echo "== STATUS.md: In progress and Next"; awk '/^## In progress/,/^## Blocked/' docs/arc/delivery/STATUS.md | head -40 | cut -c1-200; awk '/^## Next/,/^## Open founder/' docs/arc/delivery/STATUS.md | head -12 | cut -c1-200
