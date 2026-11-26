---
name: momentum-status
description: Report where the UI migration stands (branch, foundation checkpoints, unit states, failing checks). Read-only.
allowed-tools: Bash(node tools/migration/cli.mjs *) Bash(git status*) Bash(git log*)
---
Run `node tools/migration/cli.mjs status` and report its output as it is.

Add only what the files cannot say by themselves: uncommitted changes from `git status --short`, and any unit whose state in `docs/migration/progress.json` has no evidence entry.

Do not scan the repository, run tests, or change any file. A unit is complete only at the state the ledger records, never because code exists.
