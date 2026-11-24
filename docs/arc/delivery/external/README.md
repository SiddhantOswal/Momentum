# Operating model for outside coding agents

From 2026-11-24 the founders want the remaining Arc work built by Codex, with the same process the Claude Code team used for M0 and M1: a business need, a design, tickets, one ticket at a time on a branch, QA, the review gate with eight reviewers, and a merge only after a verdict. `CLAUDE.md` stays binding on every agent. `docs/arc/delivery/external-agents.md` is the builder brief. This file explains how the work is dispatched and checked.

## 1. Who does what

| Who | Does | Never does |
|---|---|---|
| Orchestrator (the Claude Code session) | Reads the plan and STATUS, writes packets, starts agent sessions, collects their reports, decides merges, runs the merge, updates STATUS and the decision log, runs approved cloud changes, asks the founders for decisions | Builds tickets; grades work it built |
| Builder session (Codex) | Builds one packet on its own branch and worktree, test first, in small commits | Reviews, verifies or merges its own work; pushes; changes Google Cloud |
| Reviewer session (Codex, a fresh session per role) | Runs one review role over a branch or a milestone and reports findings | Edits the branch under review; reviews work it built |
| Founders | Decide the questions in STATUS, approve cloud changes and live traffic moves, sign off Om's items | |

A session that built a branch never reviews it, and a reviewer session is always new, with no memory of the build. If a reviewer needs a fix, the original builder makes it in a new session that reads the findings, and the reviewer checks it again. At most three repair rounds for the same failure; then it is written down as BLOCKED.

## 2. The order for every ticket

1. **Packet.** The orchestrator writes `packets/<ticket>.md` from `packet-template.md`: goal, acceptance criteria, files to read, dependencies, branch name, tests, what is out of scope, and the live-integration rules.
2. **Build.** A builder session with the role prompt in `roles/` (for example `roles/backend-engineer.md`) works in its own worktree on `arc/<TICKET-ID>-<name>`, cut from the current `arc/main`. It writes each test, sees it fail, then builds. It hands back the report in `external-agents.md` section 4.
3. **QA.** A fresh QA session (`roles/qa-lead.md`) verifies the branch against the acceptance criteria: re-runs the tests, applies deliberate bugs ("mutations") to show each test can fail, diffs existing tests for weakened assertions, and runs the full suite and the commit check. Verdict: MERGE, MERGE WITH FIXES, or NOT YET.
4. **Fix loop.** Fixes go back to the builder, each in its own commit, then QA re-checks. Three rounds at most.
5. **Merge.** The orchestrator merges with `git merge --no-ff` into `arc/main` (subject of at most 72 characters), runs the full suite on the merged result, and updates STATUS. Builders never merge.

For tickets that touch security, AI behaviour, labels or copy, the matching reviewer role runs before the merge (see the ticket's "Owner" line), and the milestone gate repeats all of them.

## 2a. QA tiers (founders, 2026-11-24)

To save time and tokens without lowering quality, review effort follows risk:

- **Tier A, independent QA before merge:** tickets that touch authentication, sessions, approval, budgets and limits, stored state, model calls, labels, or the Arc routes, tool registry, turn runner, J1 run, conditions with provenance and data answers. A fresh QA session verifies as in section 2 step 3.
- **Tier B, no separate QA:** UI pages and states, copy, docs, wording, test-only changes and small refactors. The builder's self-check against `known-findings.md`, the commit hooks, the orchestrator's two full suite runs, and a scan for removed or loosened assertions replace it. The orchestrator also reads each Tier B diff at a high level. These tickets are reviewed in a batch (one QA session over the batch) at the end of their sub-milestone.
- **Builders do not wait for QA.** A builder starts the next ticket on a branch stacked on the previous one while QA runs. A ticket merges when its QA returns; fixes go back to the builder in a packet that lists the findings.
- **The milestone gate is unchanged:** all eight reviewers, at the end of each milestone, as `CLAUDE.md` section 5 requires.
- Every packet states its tier and carries `known-findings.md`. The orchestrator can move a ticket up a tier when its diff shows risk.

## 3. The milestone gate

At the end of each milestone, before the next one is opened, the orchestrator starts eight fresh reviewer sessions in parallel, each with `gate-packet-template.md` filled in for that milestone:

`code-reviewer`, `qa-lead`, `security-reviewer`, `ai-evals-reviewer`, `responsible-ai-reviewer`, `compliance-reviewer`, `copy-editor`, `verification-auditor`.

The orchestrator collects the reports into `docs/arc/delivery/reviews/M<n>-review.md` with a table of blocking issues, should-fix items and nits, each reviewer's verdict, and the overall verdict (GO, CONDITIONAL GO or NO-GO). Owners fix every condition, the same reviewers re-check, and the loop repeats until the verdict is GO or the three-round limit is reached. A NO-GO blocks the next milestone.

## 4. How a session is started

The founders can start a session by hand: open Codex in the repository and paste one line, for example:

```
You are the backend engineer. Read docs/arc/delivery/external/roles/backend-engineer.md, then your packet docs/arc/delivery/external/packets/ARC-M2-02.md, and do exactly what they say.
```

The orchestrator can also start a session itself with the Codex command line, once the founders have allowed it in `.claude/settings.json`:

```
# builder: its own worktree, write access to it, report saved to a file
git worktree add /Users/siddhant/Developer/momentum-wt/<TICKET-ID> -b arc/<TICKET-ID>-<name> arc/main
codex exec -m gpt-6.2-sol -c model_reasoning_effort=medium -C <worktree> -s workspace-write \
  --add-dir /Users/siddhant/Developer/Momentum/.git \
  -o <scratch>/<ticket>-report.md "<the one-line prompt above>"

# reviewer: read-only, on a detached checkout of the tip under review
codex exec -m gpt-6.2-sol -c model_reasoning_effort=medium -C <detached checkout> -s read-only --ephemeral \
  -o <scratch>/<n>-<role>-report.md "<one-line reviewer prompt>"
```

Two rules for dispatch. Builders run in separate worktrees, never in the main checkout, so two builders cannot step on each other. Test runs use their own free ports (`test/helpers/server.js`), so suites can run at the same time.

Every command passes the model and the effort explicitly (`gpt-6.2-sol`, medium), so no session depends on a config default. Codex 0.172.0 lists `gpt-6.2-sol` (`codex debug models`); the earlier 0.164.0 did not.

## 4c. Sandbox

Sessions run with `-s workspace-write` and **no network**. Tested on 2026-11-24: with network access on, a session can open local servers, but it can also reach GitHub and Google Cloud and read the gcloud credentials folder, so network stays off. With it off, `.git` is read-only and local servers cannot start, so builders hand back a commit plan and the orchestrator commits and runs the full suite (`external-agents.md` section 2a). Reviewer sessions cannot run the server-starting tests either: the orchestrator runs the full suite twice (once alongside a second run) before the review and puts the log paths in the packet, and reviewers run mutations on the in-process tests.

## 4a. No code is lost

- A builder cannot commit inside its sandbox. It leaves its work in the worktree and writes `commit-plan.json`; the orchestrator applies it (`tools/apply-commit-plan.mjs`) straight away, so work never sits uncommitted for long. A worktree with changes the orchestrator has not committed is never removed.
- Worktrees live under `/Users/siddhant/Developer/momentum-wt/`, not in `/tmp`, so a reboot or cleanup cannot remove them.
- Branches are never deleted until their merge into `arc/main` is recorded in STATUS. Abandoned work is recorded in STATUS and kept as a branch.
- Everything that ships ends up on `arc/main`. The orchestrator checks at each milestone gate that `git branch --no-merged arc/main` lists only branches that STATUS explains.
- The public `origin` (github.com/SiddhantOswal/Momentum) is never used for `arc/*`: the delivery records include security findings and design detail that must not be public (`CLAUDE.md` section 7). The backup is a git bundle of every `arc/*` branch written to `/Users/siddhant/Developer/momentum-backups/` after each merge session and each gate, and, once the founders create an empty private repository, a second remote named `backup` that receives `arc/*` after each gate, with the founders' approval for each push.

## 4b. Who reviews

From 2026-11-24 the founders want builders and reviewers to be Codex sessions, and the Claude Code session to review only at a high level. The review roles run as fresh Codex sessions as above. The orchestrator then reads each report for fit with the packet, re-runs the full suite and the commit check on the merged result, spot-checks the claims that matter (hashes, counts, anything marked PASS that touches security, labels or approval), and merges. A report that does not hold up goes back to its session, and it is never accepted on trust.

## 5. What stays with the orchestrator

- **Google Cloud changes.** A builder only writes the change request (command, reason, cost, rollback). The orchestrator records it in STATUS and `changes/`, asks the founders, runs it with `--no-traffic` first, and never deletes a resource.
- **Founder questions.** Asked one at a time, with options and a recommendation.
- **Om's items** (ARC-M0-04, the lot generator) and the pitch slot time.
- **The merge and the record.** STATUS and the decision log are updated after every merge, before the next dispatch.
- **Spot checks.** The orchestrator re-runs `npm test` and `node scripts/quality/check.mjs commits` on every merged result, and reads the diff of anything a reviewer flagged. A report is a claim, not proof: the numbers in a hand-back are checked against a run, and anything not run is marked NOT RUN.

## 6. Report format for reviewers and QA

Under 600 words, plain language:

- a table with columns ID (for example CR-1, QA-1, SEC-1, EV-1, RAI-1, CO-1, CE-1, VA-1), severity (BLOCKING, SHOULD-FIX or NIT), file and line, the finding with its evidence (command and output, or the line), and the owner role;
- BLOCKING means the next milestone or merge must wait;
- NOT RUN for anything that could not be run, with the reason;
- a last line: `VERDICT: GO`, `VERDICT: CONDITIONAL GO` (list the conditions) or `VERDICT: NO-GO`.

Reviewers do not invent findings. Each cites a line, a command or a document.

## 6a. The known review scopes

| Role | Scope at a gate |
|---|---|
| code-reviewer | every changed file (not only AI code): correctness, readability, error handling, naming, dead code, duplication, conventions, AI-sounding text |
| qa-lead | tests are real, cover the acceptance criteria, can fail, and ran; assertion audit; three full runs; mutation sample; what is NOT RUN against live services |
| security-reviewer | auth and sessions, input validation, secrets, IAM, prompt injection, data exposure, cost and quota abuse, supply chain |
| ai-evals-reviewer | the eval suites and thresholds in `responsible-ai.md`; reports NOT RUN honestly; model settings and prompts |
| responsible-ai-reviewer | human oversight, transparency, grounding, safety settings, privacy, misuse, failure handling, against `responsible-ai.md` |
| compliance-reviewer | Gemini on Vertex only, provenance labels, no data that does not exist, privacy, the public-repo boundary, every claim against its source |
| copy-editor | UI copy, docs, comments, commit messages: plain language, consistent terms, correct units |
| verification-auditor | every claim since the last gate against its evidence: hashes, test counts, mutation counts, NOT RUN statements |

## 7. Files here

- `roles/` one prompt per role, generated from `.claude/agents/`.
- `packets/` one file per ticket or review, written by the orchestrator.
- `packet-template.md` and `gate-packet-template.md`.
- `known-findings.md` the checklist every builder runs before handing back.
- `queue.md` the ordered list of remaining work and its parallel lanes.
