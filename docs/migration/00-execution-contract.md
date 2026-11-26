# 00 Execution contract (read this every session, nothing else is mandatory)

Audit basis: `arc/main` at `cb1338f6ce898dfa23493484e73c4ac8d95c07ab`, audited 2026-11-26. Machine-readable snapshot: `02a-branch-snapshot.json`.
The repo's own `CLAUDE.md` and `AGENTS.md` on `arc/main` are binding and override anything here that conflicts.

## Source-of-truth order
1. Approved product, security and safety requirements (`CLAUDE.md` sections 3 to 7, `docs/arc/delivery/responsible-ai.md`).
2. Approved design (`docs/arc/design/source/`): appearance, visible names, navigation, information architecture.
3. Verified existing business logic (constraints, costs, approvals, optimizer, SQL).
4. Verified backend contracts (`07-backend-contracts.md`, `docs/arc/delivery/06-arc-wire-contract.md`).
5. Prototype data in the design is illustrative, never operational.
6. Anything ambiguous goes to `11-product-decisions.md`. Do not decide it silently.

## Hard restrictions
- Work only on the migration branch (name per PD-02). Never touch `main`, `v2`, `arc/main`, `dev` or contributor branches directly. Never force-push, rebase shared branches or use `--no-verify`.
- Never rewrite Om's `v2` history. Never commit `docs/arc/reference/`.
- No cloud change, deploy, IAM change, billable API enablement or production data write without the founders' approval and a written command, reason, cost and rollback (`CLAUDE.md` section 7).
- Never print or commit secrets. Use the logged-in gcloud identity and Secret Manager.
- Generative work uses Gemini on Vertex AI only. No other model provider.

## Product rules that the UI must keep
- Arc and the dashboard use the same backend commands. The UI never recomputes numbers.
- Final job-card approval is human: tick the checkbox, press Approve. No Arc tool reaches approve. Approval is labelled "Demo session, simulated".
- Provenance chips are mandatory and distinct: Example, Sample, Synthetic demonstration, Model estimate, Modeled, Confirmed by operator, Missing, Demo session (simulated approval). Modeled is not measured.
- Missing data reads "Not recorded", never zero. No invented telemetry, savings or outcomes.
- Mic stays disabled in code until a voice backend exists.
- Content from orders, photos and documents is untrusted input.

## Navigation rules
- Sidebar order is fixed: Home, New Lot, Plant Explorer, Preparation Flow, Insights, Photo Diagnosis, Planning (Planning under a Future label).
- Lot is New Lot. Impact lives inside Insights. Legacy and React names exist only as hidden redirects (`06-route-registry.json`).
- Do not add a nav item because a backend module exists. Backend-only capabilities need a recorded disposition.

## Engineering standards
- Follow the repo's conventions (Node 22 ESM, Hono, React 19, Vite, Tailwind 4, `node --test`, Playwright). New dependency or framework needs an ADR.
- Reuse `src/commands/*` and `web/src/lib/api.ts`. Reuse tokens in `web/public/arc-tokens.css`. Implement the shell once (unit U01), then reuse it.
- Comments explain why only. No decorative comments, banners, dead code, unused imports, fake success states, silent catches, hard-coded production responses, or weakened tests.
- Commit messages: short, imperative, specific, in the owner's name. No trailer, co-author line, session link or mention of any assistant or tool (PD-10).
- UI copy: plain, short, taken from the design. No AI-sounding text.

## Verification principles
- A feature exists only when a test or run shows it working. Say NOT RUN or BLOCKED when so. Never invent results.
- Visual fidelity is shown by screenshots compared with the PNGs in both themes; do not claim pixel-perfect.
- Viewport matrix: primary MacBook CSS viewport (PENDING, ask the owner for `window.innerWidth x innerHeight`), 1440x900, 1280x800, 1024x768, tablet, phone. Preparation Flow label stays on one line at the primary viewport.
- Run targeted tests per unit; full `npm test` and `npm run test:ui` at gates (`10-quality-gates.md`). Stop stale `node --test` processes before runs.

## Session protocol (token discipline)
1. Read this file, then only `pages/Uxx.md` and `workflows/Wx.md` for the task, plus the listed code paths.
2. Run `docs/migration/tools/revalidate.sh` at session start. If it reports drift, stop and do a targeted delta audit.
3. Update `progress.json` and `02d-incoming-change-register.csv` when a unit or incoming change changes state.
4. Do not load the executive audit, the full discrepancy register or PDFs unless the task needs them. Use `grep` on the CSV by `DR-` id.
