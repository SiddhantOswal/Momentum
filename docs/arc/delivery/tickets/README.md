# Arc tickets

Tech lead: delivery lead. Written 2026-11-23 from `04-technical-design.md`, `05-ai-design.md` and ADR-0001 to ADR-0011. All tickets are PROPOSED until the founders approve `00-plan.md`.

One file per milestone. Each ticket has an ID, goal, acceptance criteria (AC), dependencies, owner role and test plan. Engineers take one ticket at a time on a branch named `arc/<ticket-id>-<short-name>` cut from `arc/main`, and open a PR into `arc/main`. QA records what they ran and saw in the ticket's PR. Nothing is marked done without a test run; a test not run is NOT RUN.

| File | Milestone | Target finish |
|---|---|---|
| `M0-audit-and-plan.md` | M0 audit and plan | 23 Nov |
| `M1-durable-state-and-quotas.md` | M1 durable state and quota fixes | 25 Nov |
| `M2-tool-registry-and-orchestration.md` | M2 Arc tool registry and orchestration | 26 Nov |
| `M3-new-lot-in-arc.md` | M3 new lot in Arc end to end | 27 Nov |
| `M4-M5-data-answers-and-defects.md` | M4 data answers and Insights; M5 defect check | 28 Nov |
| `M6-arc-ui.md` | M6 Arc UI to the approved design, dark and light | 29 Nov (starts 24 Nov in parallel) |
| `M7-evals-and-hardening.md` | M7 evals, guardrails and hardening | 29 Nov (suites built from M2) |
| `M8-release.md` | M8 deployment, demo runbook and release gate | 30 Nov |
| `M9-M14-production-readiness.md` | Phase B: M9 identity and named approvals, M10 environments and CI/CD, M11 security and privacy, M12 reliability and cost, M13 data and model operations, M14 plant pilot and launch | Proposed 8 Dec to 6 Mar 2027 |

Priority marks: **P0** is needed for the pitch route J1 and the evidence rules; **P1** should ship; **P2** is cut first if the plan slips (see `00-plan.md` section 6).
