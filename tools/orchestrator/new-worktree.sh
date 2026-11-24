#!/usr/bin/env bash
# Creates a worktree for one session and installs dependencies.
# Usage: new-worktree.sh <name> <branch|--detach> <base-ref>
set -euo pipefail
name="${1:?name}"; branch="${2:?branch name or --detach}"; base="${3:?base ref}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
base_dir="${WT_BASE:-$root/../momentum-wt}"
mkdir -p "$base_dir"
if [ "$branch" = "--detach" ]; then
  git -C "$root" worktree add -q --detach "$base_dir/$name" "$base"
else
  git -C "$root" worktree add -q -b "$branch" "$base_dir/$name" "$base"
fi
(cd "$base_dir/$name" && npm ci --silent 2>&1 | tail -1)
if [ -d "$base_dir/$name/web" ]; then (cd "$base_dir/$name" && npm --prefix web ci --silent 2>&1 | tail -1); fi
echo "$base_dir/$name"
