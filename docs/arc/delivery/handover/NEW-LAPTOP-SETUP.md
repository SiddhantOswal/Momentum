# Setting up a second laptop

Goal: from the handover zip to a working orchestrator session in about 30 minutes, with the repository, the tests, the hooks and the Google Cloud access all working.

## 1. Install

| Tool | Version | Used for |
|---|---|---|
| Git | any recent | the repository, worktrees, hooks |
| Node.js and npm | 22 or newer (the repo requires 20.10+; CI uses 22; 26 was used here) | the app and the tests |
| Google Chrome | current | the browser tests (`PLAYWRIGHT_CHANNEL=chrome`) |
| Google Cloud CLI (`gcloud`, `bq`) | current | read-only checks and approved cloud changes |
| Claude Code | current | the orchestrator and its subagents |
| Codex CLI (optional) | 0.172.0 or newer | outside builder and reviewer sessions; model `gpt-6.2-sol`, medium effort. Skip it and use Claude subagents for everything |
| Python 3 | any | small local scripts |

## 2. Unpack and clone

```
unzip momentum-arc-handover-<date>.zip && cd momentum-arc-handover-<date>
git clone repo/momentum-arc.bundle ~/Developer/Momentum
cd ~/Developer/Momentum
git checkout arc/main
git remote remove origin          # the bundle is only a transfer; the delivery never pushes to the public repository
git bundle verify ../momentum-arc-handover-<date>/repo/momentum-arc.bundle   # optional: checks the transfer
```

The bundle holds every branch (`arc/*`, `v2`, `main`) with full history. Branches that are not merged into `arc/main` hold work in progress; `tools/orchestrator/resume.sh` lists them. Never delete a branch until STATUS says its merge is recorded.

Private reference material (`private/reference-material.zip`) is the V5 pack, source PDFs and strategy files. It is excluded from git and must never be committed, pushed or quoted at length. Unzip it only if a task needs it: `unzip private/reference-material.zip -d docs/arc/` (it creates `docs/arc/reference/`, which `.gitignore` already excludes). Keep the zip off shared drives.

## 3. Install dependencies and the hooks

```
npm ci
npm --prefix web ci
bash scripts/install-hooks.sh      # sets core.hooksPath to scripts/git-hooks; the hooks check every commit and must never be bypassed
```

## 4. Check that everything works

```
npm test                                                        # about 11 seconds; expect: all tests pass, 0 fail, 0 cancelled (1104 at the time of the handover)
node scripts/quality/check.mjs commits                          # exit 0
npm --prefix web run build && PLAYWRIGHT_CHANNEL=chrome npm run test:ui   # about 1.5 minutes; 42 tests at the M6-01 merge
bash tools/orchestrator/resume.sh                               # where the work stands
```

If a count differs from STATUS, trust the new run and note why in STATUS. If `npm test` hangs, look for another `node --test` process holding a server (`ps aux | grep "[n]ode --test"`); never kill a process you did not start.

## 5. Google Cloud access

The project is `prepagent-hack` (region asia-south1 for Vertex AI and Firestore). Sign in with an account that has access to it; the delivery uses the logged-in identity, never a key file:

```
gcloud auth login
gcloud auth application-default login
gcloud config set project prepagent-hack
gcloud run services list --region asia-south1          # expect services momentum and prepagent
gcloud run services describe momentum --region asia-south1 --format='value(status.traffic)'
```

Live revision at the time of the handover: `momentum-00023-yaz` (rollback `momentum-v2be-8`). Never print or commit a secret; secrets live in Secret Manager. Read `docs/arc/delivery/handover/PERMISSIONS.md` for what the orchestrator may do on its own.

## 6. Permissions for the Claude session

Copy `docs/arc/delivery/handover/settings.unblocked.json` to `.claude/settings.local.json` (not committed), then start Claude Code in `bypassPermissions` mode as `PERMISSIONS.md` describes. The deny list (deletes, force-push, hook bypass, secret files, the public `origin`) stays in force.

## 7. Start the session

Open Claude Code in `~/Developer/Momentum` and paste the prompt from `docs/arc/delivery/handover/CLAUDE-ORCHESTRATOR-PROMPT.md` (also at the root of the zip as `PROMPT-FOR-CLAUDE.md`). It reads the documents in the right order, reconciles the state and continues the loop.

## 8. Things that differ from the first laptop

- Worktrees, scratch logs and the Codex sandbox folders were machine-specific and are not in the zip. Recreate worktrees with `tools/orchestrator/new-worktree.sh`; it puts them in `../momentum-wt/` next to the repository, and backups go in `../momentum-backups/` (`mkdir` both).
- The first laptop's Claude memory is not carried over; everything that matters is in the repository documents.
- Google Cloud credentials are never in the zip.
