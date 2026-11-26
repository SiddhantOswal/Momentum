# 02 Branch audit

Audit time 2026-11-26T08:04Z. Remote refs refreshed with `git fetch origin --no-prune`; nothing local was changed. Exact SHAs: `02a-branch-snapshot.json`.

## 1. Inventory

| Branch (remote) | Tip | Last commit (IST) | Authors on branch | vs `arc/main` | Notes |
|---|---|---|---|---|---|
| `dev` | `1651863` | 2026-10-16 | Siddhant | 397 behind, 0 ahead | V1 baseline. Ancestor of `main`. |
| `main` (default, local) | `f4d073b` | 2026-10-21 | Om, Siddhant | 375 behind, 0 ahead | `dev` + 22 commits (login screen, demo button, D4, UI enhancements). Public release. |
| `v2` | `eb6eab9` | 2026-11-22 | Om (18 commits over `main`) | 357 behind, 0 ahead | m2_* models, React `web/`, Google sign-in, live store, Defect Intelligence. CLAUDE.md forbids rewriting it. |
| `arc/main` | `cb1338f` | 2026-11-25 01:05 | Siddhant (357 over `v2`) | base | Integration branch for Arc and the UI work. 145 commits on 23 Nov, 203 on 24 Nov: very active. |
| `arc/ARC-M1-16-stale-fixtures` | `2d33f24` | 2026-11-25 00:26 | Siddhant (2 unique) | 186 behind, 2 ahead | Forks `arc/main` at `dd48c8c`. Three files. |
| `claude/bold-euler-orbrdw` | `f4d073b` | n/a | audit session | n/a | Identical to `main`. Not contributor work. |

Pull requests: none open or closed (`list_pull_requests state=all` returned `[]`). Branch protection: `protected=false` on all five. Working tree at start: clean; no stash; one worktree.

## 2. Findings that change the plan

1. **The history is a straight line.** `dev` → `main` → `v2` → `arc/main` (verified with `merge-base --is-ancestor`). `arc/main` contains every commit of every other pushed branch except two. Nothing in `dev`, `main` or `v2` can be lost by basing on `arc/main`. There is no cross-branch semantic conflict to reconcile among pushed branches, because there are no divergent pushed branches.
2. **The only branch-unique work is two commits** (`1a5dac5`, `2d33f24`) that retire the old `m_*` PKBX0041 acceptance check and delete two tests. `git merge-tree --write-tree arc/main <branch>` returns a tree with no conflicts. The files are unchanged on `arc/main` since the fork. STATUS.md says the deletion needs independent QA first. It has nothing to do with the UI.
3. **The UI migration is already underway on `arc/main`.** `web/` has tokens and theme (ARC-M6-01, 41 of 41 token names match the design), a disconnected Arc panel (ARC-M6-02), and `docs/arc/design/source/` is the same design set. Tickets M6-03 to M6-19 describe the rest. `docs/arc/delivery/external/queue.md` Lane 1 assigns M6-06, M6-03, M6-04 to Codex sessions. A second, independent migration will collide with that work (DR-022, DR-023).
4. **The React app is not the deployed UI.** `Dockerfile` copies `index.mjs src public sql assets config prompts` and never builds `web/`; `public/app` is not in git (DR-018). The live product is the legacy server-rendered page at `/`.
5. **Most recent work is invisible.** STATUS.md names Codex worktrees under `/Users/siddhant/Developer/momentum-wt/`, a backup directory and an unfinished turn runner. Only pushed refs can be audited. STATUS.md was last updated 2026-11-24, before the final merges.

## 3. Cross-branch capability reconciliation

Full matrix: `02c-branch-capability-matrix.csv` (presence tested by `git cat-file` on a probe path per ref, not by commit counting). Summary of the 17 requested questions:

| # | Question | Answer |
|---|---|---|
| 1 | In every branch | PO-to-job-card pipeline, demo auth, Gemini daily cap, legacy dashboard |
| 2 | Exclusive to a branch | Arc backend, durable Firestore state, quality hooks: `arc/main` only. Retire-m_* change: stale-fixtures only |
| 3 | More complete elsewhere | None. `arc/main` ⊇ all |
| 4 | Newer frontend | `arc/main` (tokens, panel shell). Both React app and tokens exist only from `v2` / `arc/main` |
| 5 | Newer backend | `arc/main` |
| 6 | Newer AI orchestration | `arc/main` (`src/arc/`, `config/arc-models.json`, `prompts/`) |
| 7 | Newer Arc | `arc/main` only |
| 8 | Extra Google Cloud integrations | `arc/main`: Firestore stores, budget counters, TTL policies (13 ACTIVE per STATUS), Vertex safety/thinking config |
| 9 | Security improvements | `arc/main`: rate limits, session mint limits, pitch-claim grant, approve guard (flag), dependency bumps from `v2` |
| 10 | Improved tests | `arc/main`: 130 test files; 1108 tests |
| 11 | Conflicting implementations | Legacy UI vs React for New Lot / Photo diagnosis / Impact (same `arc/main`), not across branches (DR-002) |
| 12 | Deliberately replaced | `m_*` models by `m2_*` (v2); stale-fixtures retires the matching acceptance check |
| 13 | Abandoned experiments | `arc/m0-r5-sa` was marked superseded in the last merge. Not present on the remote. |
| 14 | Same change under different SHAs | Not detected: `git cherry` of the two stale-fixtures commits vs `arc/main` shows both unique (`+`) |
| 15 | Branch dependencies | stale-fixtures depends on `dd48c8c`, already in `arc/main` |
| 16 | Incompatible with new design | Legacy UI (`src/operator-ui.js`, `src/ui/*`) and the React rail shell. Backend: none |
| 17 | Must survive the UI migration | Everything in `src/commands`, `src/arc`, `src/google-cloud`, `sql`, `config`, `prompts` |

## 4. Baseline evaluation

Ratings 0 to 5 are judgements from the evidence above. "UNV" marks missing evidence. I am not giving a weighted total: because `dev`, `main` and `v2` are strict ancestors of `arc/main`, `arc/main` is at least as good on every capability criterion, and a decimal score would add false precision. The ranking holds under any weights unless "integration effort" is weighted above everything else.

| Criterion (weight) | `arc/main` | `v2` | `main` | `dev` | Basis |
|---|---|---|---|---|---|
| Core functional completeness (20) | 5 | 3 | 2 | 1 | superset |
| Preserves unique contributor work (15) | 5 | 3 | 2 | 1 | v2 and Arc are in `arc/main` |
| AI and Arc maturity (15) | 3 (backend 4, user-visible 1) | 0 | 0 | 0 | typed answers not wired; evals NOT RUN |
| Architecture fit with design (10) | 4 | 2 | 1 | 1 | `arc/main` has tokens, theme, panel; `src/commands` separation |
| Build and test stability (10) | 4 | 3 UNV | UNV | UNV | this audit: 1107/1108 pass, tsc and vite pass on `arc/main`; others not run |
| Integration effort and conflict risk (10) | 3 | 4 | 5 | 5 | the base has active contributors; others are stale |
| Google Cloud and deploy readiness (8) | 3 | 2 | 1 | 1 | flags off live; no deploy script; web/ not built in image |
| Security and data integrity (7) | 4 | 2 | 1 | 1 | rate limits, guard (flagged) |
| Compatibility with ongoing development (5) | 5 | 0 | 0 | 0 | every active ticket targets `arc/main` |

**Recommendation:** base on `origin/arc/main` at `cb1338f6ce898dfa23493484e73c4ac8d95c07ab`. Confidence: high on the choice (it is forced by ancestry), medium on the plan (unpublished work, 2 days of fast movement, a live queue of in-flight tickets).

Rejected: `v2` (misses 357 commits of safety, state and the design tokens), `main` and `dev` (older still), a new consolidation branch (there is nothing to consolidate; the only unmerged pushed work is two test-infra commits), `arc/ARC-M1-16-stale-fixtures` as a base (it is behind by 186 commits).

Capabilities absent from the baseline: the two M1-16 commits; all unpublished contributor work (INC-06, INC-07); a built `/app` in the image; a receipts endpoint; Arc typed answers; durable stage record.

## 5. Integration risk hotspots (demonstrated vs speculative)

- Demonstrated: none among pushed refs (`merge-tree` on the only divergent pair is clean; every other pair is fast-forward).
- Speculative but likely: `web/src/App.tsx`, `Shell.tsx`, `lib/useApp.ts` (route table), `index.css`, `web/package.json` and lockfile, `index.mjs` (route wiring, flags), `src/schemas.js` / `src/state-schemas.js`, `config/*.json`, `test/*` (130 files, many with fixed fixtures). These are the files Lane 1 sessions are editing now.
