#!/usr/bin/env bash
# Builds the handover zip for a second laptop: the whole git repository as a bundle, the private reference
# material as a separate zip, the setup guide and prompt at the top level, a state snapshot and a manifest.
# Usage: build-handover-zip.sh [output-directory]   (default: ../momentum-handover next to the repository)
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
out="${1:-$root/../momentum-handover}"
date="$(date +%F)"
name="momentum-arc-handover-$date"
handover="$root/docs/arc/delivery/handover"
work="$(mktemp -d)"
stage="$work/$name"
mkdir -p "$stage/repo" "$stage/private" "$out"

# A key, token or private key in committed work must never travel in a zip. tools/prepare-release-snapshot.py is
# excluded because it lists the key markers it searches for; it holds no key.
if git -C "$root" grep -nIE 'AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----|ya29\.[0-9A-Za-z_-]{20,}' arc/main -- . ':!docs/arc/delivery/handover' ':!test' ':!tools/prepare-release-snapshot.py' >/dev/null; then
  echo "A secret-like string was found in arc/main. Stopping." >&2; exit 1
fi

# HEAD goes in the bundle so that a plain clone starts on the branch checked out here, which must be arc/main.
[ "$(git -C "$root" rev-parse --abbrev-ref HEAD)" = "arc/main" ] || { echo "Run this from the arc/main checkout." >&2; exit 1; }
git -C "$root" bundle create "$stage/repo/momentum-arc.bundle" HEAD --branches --tags >/dev/null 2>&1
git -C "$root" bundle verify "$stage/repo/momentum-arc.bundle" >/dev/null 2>&1

cp "$handover/README.md" "$stage/START-HERE.md"
cp "$handover/CLAUDE-ORCHESTRATOR-PROMPT.md" "$stage/PROMPT-FOR-CLAUDE.md"
cp "$handover/NEW-LAPTOP-SETUP.md" "$stage/NEW-LAPTOP-SETUP.md"

if [ -d "$root/docs/arc/reference" ]; then
  (cd "$root/docs/arc" && zip -qr "$stage/private/reference-material.zip" reference)
else
  echo "Private reference material: not present on this machine." > "$stage/private/NOT-INCLUDED.txt"
fi

bash "$root/tools/orchestrator/resume.sh" > "$stage/STATE.txt" 2>&1 || true
node "$root/tools/orchestrator/ticket-status.mjs" > "$stage/TICKETS.txt" 2>&1 || true

{
  echo "# Manifest"
  echo
  echo "Built: $(date '+%F %T %Z') from \`arc/main\` at \`$(git -C "$root" rev-parse --short arc/main)\` ($(git -C "$root" log -1 --format=%s arc/main))."
  echo "Branches in the bundle: $(git -C "$root" branch --list | wc -l | tr -d ' ')."
  echo
  echo "| SHA-256 | File |"
  echo "|---|---|"
  (cd "$stage" && find . -type f ! -name MANIFEST.md | sort | while read -r f; do printf '| %s | %s |\n' "$(shasum -a 256 "$f" | cut -d' ' -f1)" "${f#./}"; done)
} > "$stage/MANIFEST.md"

rm -f "$out/$name.zip"
(cd "$work" && zip -qr "$out/$name.zip" "$name")
echo "$out/$name.zip"
