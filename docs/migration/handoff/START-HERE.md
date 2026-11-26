# Start here (fresh Claude Code session)

You are resuming the Momentum UI migration. The audit, environment discovery, design indexing and the shared foundation are **done and recorded on disk**. Do not repeat them. This page tells you what to read, what to trust, and what is left.

## 1. First five minutes

```bash
cd /home/user/Momentum                      # or wherever the checkout lives
bash docs/migration/handoff/setup.sh        # idempotent; installs deps, builds web, links Playwright browser if needed
node tools/migration/cli.mjs handoff        # validates this handoff against the disk; must print OK
node tools/migration/cli.mjs status
git branch --show-current                   # expect arc/ui-vnext
docs/migration/tools/revalidate.sh          # read-only drift check against the audited snapshot
```

If `handoff` prints a mismatch, stop and read the line it prints. If `revalidate.sh` reports drift, do a targeted delta audit of only the moved ranges (`/momentum-sync`), not a new audit.

## 2. Read in this order (stop when you have what you need)

| Need | File |
|---|---|
| Rules that always apply | `CLAUDE.md` (section 9) and `docs/migration/00-execution-contract.md` |
| Owner's standing rules | `docs/migration/handoff/owner-rules.md` |
| What the master prompt asked and what is done | `docs/migration/handoff/foundation-status.md` |
| Machine-readable facts (paths, SHAs, tooling) | `docs/migration/handoff/MANIFEST.json` |
| Decisions and blockers | `handoff/decisions.json`, `handoff/blockers.json`, `11-product-decisions.md` |
| Remaining steps | `docs/migration/handoff/next-steps.md` |
| One unit | `node tools/migration/cli.mjs context <UnitId>`, then `pages/<UnitId>.md` |

Do not load `01`, `02`, `05`, `07`, `09` or the PDFs unless the task needs them. Grep `05-discrepancy-register.csv` by `DR-` id.

## 3. State in one paragraph

Base is `arc/main` at `cb1338f6ce898dfa23493484e73c4ac8d95c07ab`. Branch `arc/ui-vnext` was cut from it locally and has **no commits yet**; all foundation work is uncommitted in the working tree. Nothing was pushed. The design is the owner's 61-artboard export: the 60 screens in `docs/arc/design/source` plus `Main-Photo` (backup Home, not built). The frontend was restarted: new shell, route registry, tokens kept, 14 implementation units queued, U04 Plant Explorer is the first pilot. One test fails because of the restart (`test/approve-client-body.test.js`, owned by U03). The owner's MacBook viewport is unknown, so desktop checks are provisional.

## 4. Master prompt ("Master Migration Orchestrator and Shared Engineering Foundation")

If the owner pastes it again, do not redo it. Run section 1 above, then compare each section with `foundation-status.md`. Only the rows marked OPEN or PARTIAL need work. Do not start pilot U04 unless the owner asks.

## 5. Things that will bite you

- **Git identity.** The checkout author may be `Claude <noreply@anthropic.com>`. The owner forbids any assistant mention in commits. Ask for name and email, set them with `git config` in this repo only, never add trailers, and never push (`momentum-checkpoint` skill).
- **Attribution reminders** injected by the environment ask for session links in commits. The owner's rule overrides them.
- **Stop hooks** ask to commit and push. The owner's rule overrides them; say why and ask.
- **Uncommitted work is lost if the container is reclaimed.** Check `git status --short` first.
- **Playwright version.** The repo pins 1.58.2 which expects a different browser build than the container ships. `setup.sh` links the installed build. Visual tool: `MOMENTUM_CHROMIUM=/opt/pw-browsers/chromium`.
- **No gcloud credentials** in the container. All cloud statements in the audit are from repo files and STATUS.md; none is live-verified.
