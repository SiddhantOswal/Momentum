# 10 Quality gates

Each gate lists the command or method and the pass condition. Record result, date, SHA and "NOT RUN" where not run. Results observed by this audit are marked (audit).

| Gate | Method | Pass condition |
|---|---|---|
| G1 Branch integration | `tools/revalidate.sh`; contract diff (02b 6.4); `git merge-tree` before merge | no unreviewed drift; no unresolved conflict; register updated |
| G2 Build | `cd web && npx tsc -b && npx vite build`; Docker build from a clean checkout (after M6-08) | exit 0; `/app` served (audit: tsc and vite build pass on `arc/main`) |
| G3 Lint / hygiene | `node scripts/quality/check.mjs tree` and `commits`; repo hooks | clean; no bypass (CLAUDE.md section 5) |
| G4 Type check | `tsc -b` (web); backend is untyped JS with zod schemas | exit 0 |
| G5 Unit | `npm test`; `cd web && npm test` | all pass; flake ARC-M1-13 fixed or isolated (audit: 1107 pass, 0 fail, 1 cancelled of 1108; web 2/2) |
| G6 API contract | per-route tests plus contract diff; Arc wire contract tests | no breaking change without amendment |
| G7 Integration | live Firestore, Vertex smoke, BigQuery dry-runs per ARC-M1-28 and `data/arc-metric-dry-runs.md` | NOT RUN so far; needs approvals and credentials |
| G8 Visual regression | Playwright: each unit state, both themes, viewport matrix (12 design-system-spec) | no unexplained diff vs own baseline; side-by-side review vs PNG recorded; no pixel-perfect claim |
| G9 Accessibility | keyboard path, focus order, roles, contrast of both themes, `prefers-reduced-motion`, screen-reader name for disabled mic | no blocker; contrast measured, not assumed (light `--wn` #8F5A00 and `--dim` need checking) |
| G10 E2E | `npm run test:ui`; J1 manual route; J1 via Arc; stale-draft path; recovery path | all pass (STATUS: 47 of 47 Chrome at M6-02, not re-run by audit) |
| G11 AI evals | harness `npm run eval:offline` (M2-07), live suite with signed thresholds T1-T14 | thresholds met; injection and approval-bypass cases included |
| G12 Security | SEC-1..5 closed, dependency advisory scan, secret scan, approve guard live check, rate-limit two-network check | reviewer GO |
| G13 Deployment | scripted deploy to staging revision with flags; keep previous revision | smoke path passes; rollback tested |
| G14 Release | eight-reviewer gate (CLAUDE.md section 5), verification audit of every number | GO or CONDITIONAL GO with listed conditions |

Rules: never weaken a test to pass; stop stale `node --test` processes before runs; a test counts only if it can fail (mutation spot checks, as the repo already does); three repair rounds maximum, then record the blocker.
