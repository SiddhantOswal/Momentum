#!/usr/bin/env bash
# Rebuilds the local toolchain for the UI migration in a fresh container or clone. Idempotent.
# Changes nothing in git. Installs dependencies, builds the web app, and links the installed
# Playwright browser when the pinned Playwright expects a different build.
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo"

branch="$(git branch --show-current)"
echo "checkout: $repo on $branch @ $(git rev-parse --short HEAD)"
[ "$branch" = "arc/ui-vnext" ] || echo "note: expected branch arc/ui-vnext"

[ -d node_modules ] || npm ci --no-audit --no-fund
[ -d web/node_modules ] || (cd web && npm ci --no-audit --no-fund)
(cd web && npx tsc -b && npx vite build >/dev/null)
echo "web build ok"

# Playwright 1.58.2 looks for headless-shell revision 1208; some containers ship another revision.
browsers="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
if [ -d "$browsers" ] && [ ! -e "$browsers/chromium_headless_shell-1208" ]; then
  installed="$(ls -d "$browsers"/chromium_headless_shell-* 2>/dev/null | head -n1 || true)"
  if [ -n "$installed" ]; then
    ln -s "$installed" "$browsers/chromium_headless_shell-1208"
    echo "linked $installed as chromium_headless_shell-1208"
  fi
fi
[ -e "$browsers/chromium" ] && echo "visual tool browser: MOMENTUM_CHROMIUM=$browsers/chromium"

node tools/migration/cli.mjs validate
echo "setup done. Next: node tools/migration/cli.mjs handoff"
