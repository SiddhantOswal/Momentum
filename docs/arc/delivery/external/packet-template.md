# Packet: <TICKET-ID> <title>

Role: <backend-engineer | ai-engineer | frontend-engineer | data-engineer>
Branch: `arc/<TICKET-ID>-<name>`, cut from `arc/main` at <short hash>. Work in your own worktree.
Written by the orchestrator on <date>.

## Read first
1. `AGENTS.md`, `CLAUDE.md`, `docs/arc/delivery/external-agents.md` (the live-integration rules in section 2 apply).
2. Your role prompt in `docs/arc/delivery/external/roles/`.
3. The ticket <TICKET-ID> in `docs/arc/delivery/tickets/<file>`, and every ticket it depends on.
4. <design records: sections of `04-technical-design.md`, `05-ai-design.md`, `06-arc-wire-contract.md`, ADRs, `02-product-spec.md` journeys>
5. <approved screens or data records, for UI and data tickets>
6. The code you will change, and its tests.

## Goal and acceptance criteria
<copied from the ticket, with the M0 and gate additions>

## Dependencies already merged
<ticket IDs and hashes>

## Plan to write before coding
Each acceptance criterion, how you will meet it, the files you will touch, and the test for each.

## Out of scope
<what not to do; tickets that own it>

## Checks before hand-back
`npm test`, `node scripts/quality/check.mjs commits`, and for `web/` also `npm --prefix web run build` and `npm run test:ui`. Report exact counts, and mark anything not run as NOT RUN.

## Cloud needs
<none, or the change request to write: command, reason, cost, rollback>

## QA tier
Tier A (independent QA before merge) or Tier B (batched; see `external/README.md` section 2a), and why.

## Known findings
Check your work against `docs/arc/delivery/external/known-findings.md` before handing back, and say so in the hand-back.

## Review after the build
QA lead; also <security-reviewer | ai-evals-reviewer | responsible-ai-reviewer | copy-editor>, because <reason>.
