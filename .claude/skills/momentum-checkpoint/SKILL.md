---
name: momentum-checkpoint
description: Check that the working tree and ledger are consistent and prepare a scoped commit. Commits only when the user says so.
disable-model-invocation: true
allowed-tools: Bash(node tools/migration/cli.mjs *) Bash(git status*) Bash(git diff*) Bash(git log*) Bash(git config user.*) Bash(git add *) Bash(git commit *)
---
1. `node tools/migration/cli.mjs validate` and `node tools/migration/cli.mjs status`.
2. `git status --short` and `git diff --stat`. List files by area. Flag any file the current task did not touch; never stage it.
3. `git config user.name` and `git config user.email` must be the owner's identity. If they are not, stop and ask.
4. Propose one commit per logical change: short, imperative, specific message about the change itself. No trailer, no co-author line, no session link, and no mention of any assistant or tool.
5. Stage only the named paths. Commit only after the owner says to. Never push, never `--no-verify`, never change `core.hooksPath`.

Report the proposed commits and what remains uncommitted.
