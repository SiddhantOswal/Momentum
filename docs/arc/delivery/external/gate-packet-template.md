# Gate packet: M<n> <role>

Role: <one of the eight reviewer roles>. You are a fresh, independent session. You did not build any of this work.
Tip under review: `arc/main` at <short hash>. Previous gate tag or commit: <hash>.
Scope: `git diff <previous>..<tip>` (<N> files). Use a detached checkout of the tip, never the builder's worktree.

## Read first
`AGENTS.md`, `CLAUDE.md` (section 5 for your gate item), your role prompt, `docs/arc/delivery/STATUS.md`, and the previous gate file `docs/arc/delivery/reviews/M<n-1>-review.md`.

## What was merged in this milestone
<list of tickets with merge hashes and their QA verdicts>

## Known and accepted open items (not findings)
<tickets listed as open, each with its owner>

## What to check
<the role's scope from `external/README.md` section 6a, plus the points specific to this milestone>

## Rules
Read-only. Do not edit, commit or push. No Google Cloud changes. Never print a secret. Other sessions may be running tests; never kill their processes.

## Report
The format in `external/README.md` section 6, under 600 words, ending with the verdict line.
