# Two machines, one repository: who writes what

From 2026-11-25 two sessions work on the same GitHub repository (`origin`, public) at the same time: the build on Om's machine and the pitch on Siddhant's laptop. The rule is one writer per branch family, so histories never diverge and nothing is built twice.

| | Build lane: Om's machine | Pitch lane: Siddhant's laptop |
|---|---|---|
| Writes | `arc/main` and every `arc/*` branch; `STATUS.md`, the queue, the decision log, review files, tickets, change records | `pitch/*` branches only (`docs/arc/pitch/`, `docs/arc/delivery/external/pitch/`, `tools/pitch/`) |
| Cloud | the only machine that changes Google Cloud (Cloud Run, BigQuery, Firestore, secrets, IAM, budgets) and spends the ₹10,000 budget (live evals, live checks) | read-only at most; no live Gemini calls; no cloud change |
| Merges into `arc/main` | yes, the only machine that does | never |
| Pushes | `arc/main` and named `arc/*` work branches, normal pushes, never forced | `pitch/*` only after the founders confirm; never `arc/*`, `main` or `v2` |
| Reads from the other | `pitch/main`, when the founders hand it over | `origin/arc/main`: `git fetch origin arc/main` to read merged work, `ticket-status`, gate files and test counts for evidence |

## Rules

1. **Single writer.** Neither machine writes to the other's branches. If one needs a change on the other's side (a pitch claim needs a number from a new measurement; a build ticket needs a pitch fix), it asks through the founders or leaves a note in `docs/arc/delivery/handover/NOTES-FOR-<machine>.md` on its own branch.
2. **Sync before and after.** The build machine runs `git fetch origin` at the start of each session and pushes `arc/main` after each merge session and at each gate. The pitch machine fetches `origin/arc/main` before it verifies any claim, and records the commit it verified against.
3. **Evidence comes from `origin/arc/main`.** The pitch lane marks a capability `[BUILT]` only if the merge is on `origin/arc/main`. Numbers that need a run (the release candidate's acceptance run) are produced by the build machine, saved in the repository (`docs/arc/delivery/reviews/acceptance-<date>.md`, the measurement files under `data/`), and then used by the pitch lane. The pitch lane never runs the live service to get a number.
4. **Pitch into `arc/main`.** When the pitch package passes its reviews and the founders confirm it may be public, the pitch machine pushes `pitch/main` to `origin`. The build machine merges it with `git merge --no-ff origin/pitch/main -m "Merge pitch: <version>"`. The files are disjoint from all build work, so the merge is conflict-free, and it adds one STATUS line.
5. **Shared files.** `STATUS.md` and the decision log have one writer, the build machine. The pitch status lives in `docs/arc/pitch/README.md` on the pitch branch. The handover zip is rebuilt by whichever machine is asked to, from its own `arc/main` checkout after a fetch.
6. **Conflicts and surprises.** If the two machines ever edited the same file or a branch moved unexpectedly, stop and ask the founders; never force-push, never reset, never rewrite pushed history; the `arc/main` writer resolves with a merge commit.
7. **Handing a lane over.** If one machine stops, its last act is a handoff note in `STATUS.md` (build lane) or in `docs/arc/pitch/README.md` (pitch lane), committed and pushed, listing branches in flight, worktrees with uncommitted work, running sessions and the next three actions.

## Starting state on 2026-11-25

`origin/arc/main` is at `664fac9` or later. In flight on the build lane: the M1 gate conditions, ARC-M2-05 (answer writer), M2-06, M2-07, the UI lane (M6-03 onward), `arc/ARC-M1-16-stale-fixtures` (Copilot, two commits, awaiting an independent QA because it deletes tests). In flight on the pitch lane: `pitch/PITCH-01-claims-evidence` (built and through two review-fix rounds, awaiting the orchestrator's check), PITCH-02 and PITCH-03 not started.
