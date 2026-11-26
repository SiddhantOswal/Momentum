# 02b Branch integration plan

Nothing here has been executed. All commands need the approvals in section 9.

## 1. Decision summary

- Base: `origin/arc/main` @ `cb1338f6ce898dfa23493484e73c4ac8d95c07ab`.
- No consolidation branch is needed before the UI work. The history is linear and `arc/main` already contains `dev`, `main` and `v2`.
- Migration branch: **`arc/ui-vnext`**, cut from the base. The repo convention is `arc/<ticket>` feature branches that merge into `arc/main` through a review gate (CLAUDE.md sections 5 and 7). Unit branches use `arc/ARC-M6-<nn>-<slug>` so they map to the existing M6 tickets. This name is a proposal (PD-02).
- Because `arc/main` is moving, `arc/ui-vnext` is an integration branch that is synchronised, not frozen (section 6).
- Hard prerequisite (PD-02, DR-023): the founders say who owns `web/src/**` today. Without it, do not cut the branch.

### 1a. Variant requested by the product owner: restart the frontend from scratch (PD-11)

The owner considers the existing UI work "messed up". This audit found no evidence of breakage (web `tsc` and build pass, 2 of 2 web tests) but does confirm it does not follow the approved navigation (DR-001). Recommended reading of "from scratch":
- **Restart the frontend only.** Keep `arc/main` as base so `src/`, `config/`, `prompts/`, `sql/`, tests and the Arc backend are kept. Restarting the backend would discard about 375 commits and 1,100 tests; not recommended four days before the release candidate.
- On `arc/ui-vnext`, replace `web/src/components/Shell.tsx`, `App.tsx`, `lib/useApp.ts` routes and the three `screens/*` with new units built to `pages/Uxx.md`. Keep only what is verified and unrelated to layout: `web/public/arc-tokens.css` (41 of 41 names match the design per repo QA), `lib/api.ts`, `lib/session.ts`, `lib/live.ts`, `ArcPanel.tsx` (mic disabled, tests exist). Reusing them is a choice (PD-11), not a requirement.
- Do not start from `main`, `dev` or `v2`: the UI there is the legacy page or the older React app, and Arc is absent.
- Which branch is "messed up" must be named. If it is not `arc/main` or `arc/ARC-M1-16-stale-fixtures`, it is unpublished and invisible to this audit (DR-022).

## 2. Integration operations

| Op | Source | Commits | Target | Treatment | Depends on | Conflict expectation | Required tests | Rollback | Order |
|---|---|---|---|---|---|---|---|---|---|
| OP-00 | `origin/arc/main` | `cb1338f` | `arc/ui-vnext` (new) | Branch cut, no merge | revalidation, PD-02 | none | `npm test`, `npm run test:ui`, web `tsc -b && vite build` | delete the unpublished branch | 1 |
| OP-01 | `origin/arc/ARC-M1-16-stale-fixtures` | `1a5dac5`, `2d33f24` (cherry-pick in order) | `arc/main` via Siddhant's gate, NOT via this branch | Defer; independent QA first (STATUS.md) | QA verdict | `merge-tree` clean | `test/optimizer-acceptance-tool.test.js`, `tools/validate-optimizer-acceptance.mjs` run | revert the two commits | after QA, optional |
| OP-02 | `origin/arc/main` (future tips) | range `cb1338f..tip` | `arc/ui-vnext` | Reviewed merge (section 6) | register entry per range | `web/src/**`, `index.mjs`, `config`, lockfiles | targeted per area | `git revert -m 1` of merge commit | recurring |
| OP-03 | unpublished lane work (INC-06) | n/a | n/a | Defer; require push | PD-08 | HIGH | n/a | n/a | before U03, U11 |

There are no other source branches to merge. Do not merge `v2`, `main` or `dev`: already ancestors, a merge would be a no-op.

## 3. Conflict hotspots (to watch, not yet demonstrated)

Routing and navigation (`web/src/App.tsx`, `lib/useApp.ts`, `components/Shell.tsx`), theme (`web/src/index.css`, `public/arc-tokens.css`), API client (`web/src/lib/api.ts`), backend wiring (`index.mjs`), Arc orchestration (`src/arc/**`), schemas (`src/schemas.js`, `src/state-schemas.js`), Firestore documents, `config/*.json`, `package-lock.json` and `web/package-lock.json`, `Dockerfile`, test fixtures. API shape and Firestore changes are the ones that break a finished screen silently.

## 4. Commands (do not run before approval)

### 4a. Local preparation (read-only except for new worktree)

```bash
git fetch origin --no-prune
docs/migration/tools/revalidate.sh          # must print NO DRIFT, else stop and delta-audit
git status --short                          # must be empty in the checkout you use; otherwise use a worktree
git rev-parse origin/arc/main               # expect cb1338f6ce898dfa23493484e73c4ac8d95c07ab (or approved newer tip)
```

```bash
git worktree add -b arc/ui-vnext ../momentum-ui-vnext origin/arc/main
cd ../momentum-ui-vnext
git branch --unset-upstream 2>/dev/null || true   # no upstream so a stray push cannot reach arc/main
git log -1 --format=%H                              # re-confirm base
scripts/install-hooks.sh                            # repo hooks; never bypass them
```

### 4b. Baseline verification (before any change)

```bash
npm ci && npm test            # expect 1107+/1108; known flake: weather timeout (ARC-M1-13)
(cd web && npm ci && npx tsc -b && npx vite build && npm test)
npm run test:ui               # needs the repo's Playwright setup; record result, do not assume
```

### 4c. Integration (only with approval)

```bash
git fetch origin --no-prune
git log --format='%h %an %s' arc/ui-vnext..origin/arc/main   # review the range first
git diff --stat arc/ui-vnext...origin/arc/main -- web index.mjs src/arc src/schemas.js config package-lock.json web/package-lock.json
git merge --no-ff --no-commit origin/arc/main                 # resolve, run targeted tests
git commit                                                     # message: "Merge arc/main <short-sha> into ui-vnext"
```

Rollback of a bad sync: `git revert -m 1 <merge-sha>`. Never reset or force-push. If a conflict touches a file a contributor owns, stop and ask the owner.

### 4d. Publication (requires explicit approval; separate from everything above)

```bash
git push -u origin arc/ui-vnext        # first publication of the integration branch
# merging back into arc/main happens only through the review gate in CLAUDE.md section 5
```

## 5. Verification gates between operations

After OP-00: baseline results match section 4b. After each OP-02: `npm test` full, web build, browser tests for the touched area, API contract check (section 7 below). Textual merge success is not evidence of compatibility; a contract diff must be clean (`07-backend-contracts.md`).

## 6. Staying in sync with ongoing development

1. **Freeze the audited baseline**: `02a-branch-snapshot.json` (tip SHA, merge bases). `tools/revalidate.sh` compares live refs to it.
2. **Classify every incoming range** in `02d-incoming-change-register.csv` with: capability, dependencies, contract impact, disposition (merge now / merge before unit X / defer / exclude), verification.
3. **Merge cadence**: at unit boundaries and at fixed checkpoints (daily until freeze), never automatically.
4. **Contract diff** on each range: `git diff <old>..<new> -- index.mjs src/schemas.js src/state-schemas.js config sql prompts docs/arc/delivery/06-arc-wire-contract.md` plus new `process.env` flags. Any change to a route, schema, flag, Firestore collection or SQL file updates `07-backend-contracts.md` and the affected `pages/Uxx.md` first.
5. **No older-overwrites-newer**: when a conflict is resolved in `web/src/**`, the side that implements the approved design wins for presentation; the side with newer verified behaviour wins for data and commands. Record the choice in the merge commit body.
6. **Dependency changes**: any new package needs an ADR (CLAUDE.md section 2); lockfile conflicts are regenerated with `npm ci` after taking the incoming `package.json` and re-adding ours, never hand-edited.
7. **Ownership** (proposal PD-08): `arc/main` owner (Siddhant) owns backend, Arc orchestration, Firestore schemas, cloud and deploy; Om owns plant data, model figures, sign-offs and the `v2` history; the UI migration owner owns `web/src/components`, shell, routes and tokens; shared API contracts change by a written contract amendment reviewed by both.
8. **Regression**: each merge reruns the targeted tests in the register entry plus the J1 smoke path.
9. **Final freeze**: proposed 2026-11-29 18:00 IST for functionality (release candidate is 30 Nov per `00-plan.md`; pitch 4 Dec). After freeze only fixes with a recorded reason.
10. **Audit trail**: merge commit bodies list the register IDs; `progress.json` records per unit the base SHA it was last verified against.

## 7. Mandatory pre-implementation revalidation

Run `tools/revalidate.sh`. If it reports drift: list new commits, new or removed branches, touched contract files; reassess OP-01 to OP-03 and `pages/*`; confirm the base SHA; if material (baseline moved by more than docs or tests, new branches, new open PR on `web/`), do a targeted delta audit of only the changed ranges and get approval before executing a changed strategy.

## 8. Rollback considerations

Everything is additive on an unpublished branch until 4d. After 4d, rollback of integration is `git revert` of the merge commit on `arc/ui-vnext`; deleting a published branch needs approval. Database and cloud changes are out of scope for this plan; flag enablement (ARC-M8-05) has its own rollback record per CLAUDE.md section 7.

## 9. Approvals required

PD-01 (design export confirmed), PD-02 (who executes the migration and branch name), PD-08 (lane ownership and unpublished work), and a go on section 4c and 4d separately.
