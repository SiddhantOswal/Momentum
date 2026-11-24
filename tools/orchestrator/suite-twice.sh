#!/usr/bin/env bash
# Runs the full unit suite twice at the same time in one worktree and prints both counts.
# Reviewer sessions cannot start local servers, so the orchestrator runs this and hands them the logs.
# Usage: suite-twice.sh <worktree> <label> <log-dir>
set -uo pipefail
worktree="${1:?worktree}"; label="${2:?label}"; logs="${3:?log directory}"
mkdir -p "$logs"
cd "$worktree"
if pgrep -f "node --test" >/dev/null; then echo "Note: other node --test processes are running; do not kill them." >&2; fi
(npm test > "$logs/$label-run-a.txt" 2>&1 &)
npm test > "$logs/$label-run-b.txt" 2>&1
sleep 10
for run in a b; do
  echo "run $run: $(grep -E '^ℹ (tests|pass|fail|cancelled)' "$logs/$label-run-$run.txt" | tr '\n' ' ')"
done
node scripts/quality/check.mjs commits | tail -1
