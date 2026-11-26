#!/usr/bin/env bash
# Read-only drift check against 02a-branch-snapshot.json. Fetches remote refs without pruning
# and prints differences. It changes no local branch, worktree or file.
set -euo pipefail
repo="${1:-$(git rev-parse --show-toplevel)}"
snap="$repo/docs/migration/02a-branch-snapshot.json"
git -C "$repo" fetch origin --no-prune --quiet
python3 -I - "$repo" "$snap" <<'PY'
import json, subprocess, sys
repo, snap = sys.argv[1], sys.argv[2]
def git(*a): return subprocess.check_output(["git", "-C", repo, *a], text=True).strip()
s = json.load(open(snap))
drift = 0
known = set()
for name, b in s["branches"].items():
    known.add(name)
    try:
        now = git("rev-parse", "origin/" + name)
    except subprocess.CalledProcessError:
        print(f"REMOVED  {name} (was {b['sha'][:8]})"); drift += 1; continue
    if now != b["sha"]:
        n = git("rev-list", "--count", f"{b['sha']}..{now}")
        print(f"MOVED    {name}: {b['sha'][:8]} -> {now[:8]} (+{n} commits)")
        print(git("log", "--format=  %h %an %ad %s", "--date=short", f"{b['sha']}..{now}"))
        print("  files touched in contract areas:")
        print(git("diff", "--stat", b["sha"], now, "--", "index.mjs", "src/commands", "src/arc", "src/schemas.js",
                  "src/state-schemas.js", "config", "sql", "web/src", "web/package.json", "package.json",
                  "Dockerfile", "docs/arc/design", "ops"))
        drift += 1
heads = git("for-each-ref", "--format=%(refname:short)", "refs/remotes/origin").split()
for h in heads:
    n = h.removeprefix("origin/")
    if n not in known and n != "HEAD" and not n.startswith("claude/"):
        print(f"NEW      {n} at {git('rev-parse', h)[:8]}"); drift += 1
print("NO DRIFT: snapshot is current" if drift == 0 else f"DRIFT: {drift} change(s). Run a targeted delta audit before implementing; get approval if the baseline moved.")
sys.exit(1 if drift else 0)
PY
