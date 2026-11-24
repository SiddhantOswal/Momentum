# The delivery lifecycle, stage by stage

How software is built here, end to end. Each stage names who does it, what it needs, what it produces and where, and the check that closes it. Every document named here is in the repository. `CLAUDE.md` sections 1 to 8 are the rules; this file is the map.

| # | Stage | Done by | Inputs | Output (where) | Closed by |
|---|---|---|---|---|---|
| 1 | Business need | business-analyst | the founders' brief, `docs/arc/reference/` (private) | `docs/arc/delivery/01-business-requirements.md`: users, outcomes O1 to O10, constraints | M0 gate |
| 2 | Product spec | product-manager | 01 | `02-product-spec.md`: journeys J1 to J11, acceptance criteria AC*, design gaps G1 to G17, scope, non-goals | M0 gate |
| 3 | Discovery and data audit | solutions-architect, data-engineer | the code, BigQuery (read-only), the Codex repo (read-only) | `03-discovery-audit.md`, `data/data-audit.md`, `data/stale-claims.md`, `data/PKBX0041-m2-rerun.md` | M0 gate |
| 4 | Technical and AI design | solutions-architect, AI architect | 01 to 03 | `04-technical-design.md`, `05-ai-design.md`, ADR-0001 to ADR-0011 in `adr/`, `06-arc-wire-contract.md` | M0 gate |
| 5 | Plan and tickets | tech lead (the orchestrator) | 01 to 06 | `00-plan.md` (milestones M0 to M14, test and eval plan, gap lists, definition of production-ready), tickets in `tickets/` | plan approval by the founders |
| 6 | Responsible AI policy | AI evals and RAI reviewers, founders | the plan | `responsible-ai.md` with signed thresholds T1 to T14 | the founders sign it; agents never change it |
| 7 | Packet | orchestrator | a ticket and everything it depends on | `external/packets/<ticket>.md` | the builder can start without questions |
| 8 | Build | backend, AI, frontend and data engineers, one ticket at a time on `arc/<ticket>-<name>`, test first | the packet, `external/known-findings.md` | code, tests, config, prompts, SQL, UI; small commits through the hooks | hand-back report with evidence |
| 9 | Test | the builder (focused tests), the orchestrator (full suite twice, browser suite) | the branch | `npm test`, `npm run test:ui`, `node scripts/quality/check.mjs commits`, logs | counts match, 0 fail, 0 cancelled |
| 10 | QA | qa-lead (a different session) for risky tickets | the branch, the logs | a report: each AC and its test; deliberate-bug (mutation) results; assertion audit; NOT RUN list | verdict MERGE, MERGE WITH FIXES or NOT YET |
| 11 | Fix loop | the builder, from a fix packet | the findings | fixes in their own commits, each test seen to fail first | re-check or the orchestrator's own mutation check; at most three rounds |
| 12 | Merge and record | orchestrator | the verified branch | a `--no-ff` merge into `arc/main`, `STATUS.md`, the decision log, the queue, a backup bundle | suite green on `arc/main` |
| 13 | Milestone gate | eight reviewers in parallel: code, QA, security, AI evals, responsible AI, compliance, copy editor, verification auditor | the diff since the last gate | `reviews/M<n>-review.md`: findings by deadline, verdicts, overall GO, CONDITIONAL GO or NO-GO | owners fix conditions, the same reviewers re-check |
| 14 | UI | frontend-engineer | the approved screens in `docs/arc/design/` (light and dark HTML and PNG), the wire contract, the gap lists in `00-plan.md` section 6 | `web/` React app, Playwright specs in `test/browser/`, screenshots of the running app in both themes | exactly as the approved screens; unbuilt backend shows "not connected"; founders approve new states (D4); copy editor checks text |
| 15 | Evals and guardrails | AI engineer, AI evals reviewer | `05-ai-design.md` section 7, `responsible-ai.md` | `evals/` suites, `npm run eval:offline`, live eval runs on the separate counter | thresholds met; unrun suites reported NOT RUN |
| 16 | Compliance and proofreading | compliance-reviewer, copy-editor | every claim, label, number and text | findings at each gate | every number traces to a source; labels stay distinct; plain language |
| 17 | Cloud changes | orchestrator | a change record | `changes/<date>-<name>.md`, the change, a read-back | cost, rollback and result recorded; `--no-traffic` first |
| 18 | Release | release-manager, orchestrator | M7 and M8 tickets | scripted deploy, demo-day scaling, runbook, founder acceptance script, `reviews/M8-review.md` | ARC-M8-05 release gate GO, then live traffic moves; the previous revision is kept |
| 19 | Production readiness (Phase B) | the same loop | `tickets/M9-M14-production-readiness.md`, `00-plan.md` section 9 | sign-in and roles, staging and production, privacy, monitoring, pilot, accessibility | the 22-line checklist with evidence for every line |

## The UI, in particular

- Source of truth: `docs/arc/design/source/html/{light,dark}/*.html` (tokens in the CSS) and the PNGs in `docs/arc/design/{light,dark}/`. Where HTML and PNG disagree, the founders decided: the app follows the PNGs (Inter, not Inter Tight).
- Built in the existing `web/` app (React 19, Vite, Tailwind 4, TypeScript). No new UI framework without an ADR. Tokens in `web/public/arc-tokens.css`; dark and light, system preference respected until the user chooses.
- Every approved page ships (Q7). The gap lists are in `00-plan.md` section 6: UI elements with no backend (U1 to U14) show the designed "not connected" state; backend features missing from the UI (B1 to B11) are never added by an agent, they go to the founders.
- Rules the UI never breaks: approval is a checkbox plus a button and only a human presses it; the mic button is shown and disabled with no handler; every value shows its provenance label; "Generated by Gemini" appears only where Gemini wrote the text; no progress percentage; copy follows `data/stale-claims.md`.
- Tests: Playwright specs in `test/browser/` (build `web/` first, run in Chrome, one run at a time because of port 4182), plus screenshots of the running app in both themes at 1440 px and 375 px compared by eye with the approved PNGs.

## What "high quality" means here

No AI-sounding text, no placeholder comments, no claim without evidence, no hard-coded or local-only product path, tests that were seen to fail, deliberate-bug checks by someone who did not write the code, reviewers independent of the work they review, and an honest NOT RUN where something did not run. `CLAUDE.md` section 2 and 3 are the standard; the M0 and M1 review files show it applied.
