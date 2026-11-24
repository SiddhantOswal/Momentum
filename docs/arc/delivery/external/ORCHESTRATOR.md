# Orchestrator runbook

For the session that runs the Arc delivery: today the Claude Code session, and any successor (a Codex session, or a person) if that session cannot continue. Everything an orchestrator does is written here, with the exact commands. `CLAUDE.md` is binding and wins over this file. `external/README.md` explains the operating model and `external-agents.md` is the builder brief; this file is the orchestrator's own procedure.

An orchestrator does not build tickets. It dispatches builders and reviewers, checks what they report, merges, keeps the record, runs the cloud steps the founders approve, and asks the founders the questions only they can answer.

## 1. Start here (cold start, 10 minutes)

1. Read `CLAUDE.md`, then `docs/arc/delivery/STATUS.md` (Done, In progress, Blocked, Next, Open founder questions, Known risks, Decision log), then `external/decisions-and-defaults.md` (what is decided, and the default for every open item), then `external/queue.md`.
2. Run `tools/orchestrator/resume.sh`. It prints the `arc/main` tip, the last merges, every `arc/*` branch not merged (each must be explained in STATUS), the worktrees, running sessions, uncommitted changes in worktrees, the newest backup and the STATUS "In progress" and "Next" sections.
3. Reconcile: every unmerged branch is either In QA, Building, Waiting on a fix, or abandoned and written down. A worktree with uncommitted files is a builder that has finished or stopped: look for `commit-plan.json` and a report in the scratch folder, and never delete it. If something running or half-done is not in STATUS, write it down first.
4. Check the machine: `ps aux | grep "[n]ode --test"` and `lsof -ti :4182` before any test run. Other sessions may be running; never kill a process you did not start.
5. Pick the next action from section 3 (the loop). When STATUS and the repository disagree, the repository wins; fix STATUS.

## 2. What you may and may not do

| You do | You never do |
|---|---|
| Write packets, start sessions, read reports, apply commit plans, run the suites, merge into `arc/main` with `--no-ff`, update STATUS, the queue and the review files | Push to any remote, force-push, rewrite `v2` or Om's commits, merge into `v2` or `main` |
| Run Google Cloud changes the founders approved, one at a time, after writing the change record | Change Google Cloud without a written change record (command, reason, cost impact, rollback) and a founder yes; delete a resource; move live traffic without a founder yes |
| Ask a founder one clear question with options and a recommendation | Pick quietly when two roles disagree: write both positions and the evidence, then ask |
| Fix a technical conflict between documents as tech lead, and record it in the decision log | Mark anything done that is not done; invent a test result, screenshot, metric or approval; say PASS for a check that did not run (write NOT RUN or BLOCKED) |
| Keep `docs/arc/reference/` out of git and out of every packet | Print, commit or paste a secret; read `.env` files; use `--no-verify`, `-n`, or change `core.hooksPath` |

Commit rules, enforced by `scripts/git-hooks/` and CI: subject at most 72 characters, imperative, specific; no attribution trailers; the words "Claude", "Codex" and "Copilot" are rejected in commit subjects; the banned phrases in `CLAUDE.md` section 2 are rejected in committed text (so a doc that lists them must point to `CLAUDE.md` instead of quoting them); no emoji. A rejected commit did not happen: fix and make a new commit.

Branching, merging, remotes and the release tag are specified in `handover/GIT-WORKFLOW.md`; follow it exactly.

## 3. The loop

```
write packet -> new worktree -> builder session -> apply commit plan -> rebase -> two suite runs
   -> QA session (Tier A) -> read report -> fixes (new packet) -> verify fix yourself -> merge -> record
```

Run lanes in parallel (backend, AI, data, frontend), each ticket in its own worktree. Builders do not wait for QA: start the next ticket on a branch stacked on the previous one.

### 3.1 Write the packet

Copy `external/packet-template.md` to `external/packets/<TICKET>.md` and fill every section: role, branch, base, read-first list (ticket, design sections, ADRs, wire contract, code, tests), acceptance criteria copied from the ticket with the gate additions and the carry-overs written into the ticket by earlier QA, dependencies already merged, out of scope, checks, cloud needs, QA tier and why. Look at `external/packets/ARC-M2-03.md` as a worked example. Put the known pitfalls of section 7 in when they apply. Commit the packet on a branch and merge it so the record shows what the builder was told (`git switch -c arc/ARC-SETUP-NN-<name>`, commit, `git switch arc/main`, `git merge --no-ff`).

QA tiers (`external/README.md` section 2a): Tier A (independent QA before merge) for authentication, sessions, approval, budgets, stored state, model calls, labels and the Arc core; Tier B (batched, no separate QA) for UI pages, copy, docs and test-only changes. Move a ticket up a tier when its diff shows risk.

### 3.2 Create the worktree and start the builder

```
tools/orchestrator/new-worktree.sh <TICKET> arc/<TICKET>-<name> <base-ref>      # base: arc/main, or the previous ticket's branch when stacking
tools/orchestrator/codex-session.sh builder <role> <TICKET>.md <worktree> <scratch>/<TICKET>-report.md
```

Run the session in the background and wait for its completion notice; do not poll. Roles: `backend-engineer`, `ai-engineer`, `frontend-engineer`, `data-engineer`. The session runs in a sandbox with no network and no git writes, with the model and effort fixed in the script (`gpt-6.2-sol`, medium). If a session stops with "usage limit" in its log, its work is still in the worktree: back it up (`git diff` plus untracked files to `../momentum-backups/<TICKET>-wip-<date>/`), tell the founders the reset time, and either wait or finish with another builder that treats the draft as unreviewed.

A session that ends with no report and no commit plan did not finish. Read the tail of its log, never assume.

### 3.3 Apply the plan

The builder leaves `commit-plan.json` (an array of `{message, files}`) and uncommitted files. Read the report first, then the plan, then `git status --short`: every changed file must be in some entry except `commit-plan.json` itself. Remove changes to files the builder must not touch (STATUS.md, `external/queue.md`, `reviews/`) from the plan and the tree, then:

```
node tools/apply-commit-plan.mjs commit-plan.json <worktree> && rm -f <worktree>/commit-plan.json
```

It makes one commit per entry in order, and the hooks run on each. If a hook rejects a message, fix the plan entry and rerun from the failed group. Then `git rebase arc/main` in the worktree (resolve conflicts yourself; if the builder stacked on an unmerged branch, the rebase moves it onto the merged result).

### 3.4 Run the suites yourself

Builders and reviewers cannot start local servers. You run the full suite outside the sandbox, twice at once, and keep the logs for the reviewers:

```
tools/orchestrator/suite-twice.sh <worktree> <TICKET> <scratch>/logs
```

Both runs must show the same count, `fail 0`, `cancelled 0`, and the commit check must pass. Different counts or a cancelled test are a failure to understand, not a flake to ignore. For `web/` changes also run `npm --prefix web run build` and then `PLAYWRIGHT_CHANNEL=chrome npm run test:ui` (the config uses fixed port 4182, so only one Playwright run at a time, and build first or about ten tests fail).

### 3.5 Tier A: start a QA session

Create a detached checkout of the branch head (`new-worktree.sh review-<TICKET> --detach <branch>`), write `packets/<TICKET>-QA.md` from `gate-packet-template.md` with the evidence log paths, and start `codex-session.sh reviewer qa-lead <TICKET>-QA.md <review-worktree> <report>`. A QA packet always asks for: each acceptance criterion with its test; deliberate bugs ("mutations") applied one at a time and reverted, with a count of how many a test catches (a test must fail by assertion, never by hang); the list of existing assertions removed or changed; the checks against `known-findings.md`; the claims to verify, copied from the builder's report; what is NOT RUN. After the report, confirm the review checkout is clean (`git -C <worktree> status --short`).

### 3.6 Read the report like a reviewer

A report is a claim, not proof. Before you accept it: check that its numbers match the evidence you hold (the suite logs, the commit log); that every BLOCKING or SHOULD-FIX has a file and a line; that "caught" mutation counts are plausible; and that findings are real (QA reviewers have been wrong on small points; reproduce a contested one yourself, in a few lines). Decide each finding: fix now, carry to a named ticket, or waive with the reason written in STATUS (for example, a commit-hygiene finding that would force a rebase of stacked work). A decision that changes a design record is a tech-lead decision: write it in the decision log, amend the record in the ticket that owns it.

Verdicts: MERGE; MERGE WITH FIXES (write a fix packet that lists each finding verbatim, plus any decision you made, then a short re-check or your own mutation check for test-only fixes); NOT YET (fix packet, then a full second QA). At most three repair rounds for the same failure; after that write BLOCKED with the reason and ask the founders.

### 3.7 Fix packets

A fix packet names the branch, quotes each finding, states decisions already taken, restates "do not weaken any assertion", and says to fix everything else and report the conflict when one finding conflicts with a record (a builder that stops the whole packet on one conflict wastes a round). Builders again leave a commit plan.

### 3.8 Verify, merge, record

Verify test-only fixes yourself: apply the deliberate break the finding describes in a scratch copy of the code, see the new test fail, restore (`git checkout -- <file>`), see it pass. Then:

```
git switch arc/main
git merge --no-ff -q <branch> -m "Merge <TICKET>: <what it does>"      # subject at most 72 characters
npm test                                                                   # on arc/main: all green, same count as the branch plus anything merged meanwhile
node scripts/quality/check.mjs commits
```

If the merged result fails, find the interaction before doing anything else. Then update `STATUS.md` (a Done bullet: merge hash, what shipped, who built, QA verdict and mutation counts, what is NOT RUN, the suite count; Known risks and the decision log when they changed), `external/queue.md`, and commit the record on a branch and merge it. After a merging session and at every gate, refresh the backup: `git bundle create <backups>/arc-<date>-<n>.bundle --branches='arc/*'` and `git bundle verify` it.

Keep worktrees and branches until their merge is recorded in STATUS. Remove nothing that has uncommitted work.

## 4. The milestone gate

At the end of each milestone (M2 next, then M3 to M8), before the next milestone opens, run all eight reviewers as fresh sessions, in parallel, each with `gate-packet-template.md` filled in: `code-reviewer`, `qa-lead`, `security-reviewer`, `ai-evals-reviewer`, `responsible-ai-reviewer`, `compliance-reviewer`, `copy-editor`, `verification-auditor`. Scope is `git diff <previous gate tip>..<tip>`; the previous gate's file is `reviews/M<n-1>-review.md`. Give them the suite logs, the list of merged tickets with hashes and QA verdicts, and the known open items. Read-only for all of them.

Collect the reports into `docs/arc/delivery/reviews/M<n>-review.md` in the shape of `reviews/M1-review.md`: a table of verdicts, conditions grouped by deadline (before the next milestone's merges, before the budget flags go live, before the next gate), records to correct, wording, nits, release conditions carried forward, and what was NOT RUN. The overall verdict is GO, CONDITIONAL GO (conditions listed) or NO-GO (stops the next milestone until the owners fix the blocking issues and the same reviewers re-check, at most three rounds). Evals not run are reported as NOT RUN, never as a pass; the thresholds T1 to T14 in `responsible-ai.md` are the pass line and an agent never sets them.

## 5. Cloud changes

Local, reversible work needs no approval. Anything that changes Google Cloud does:

1. Write the change record in `docs/arc/delivery/changes/<date>-<name>.md`: the exact command, the reason, the cost impact, the rollback, and how the result will be read back.
2. Under the founders' standing approvals (`handover/PERMISSIONS.md`, 2026-11-24) no per-step yes is needed for the changes listed there; put a line in STATUS before you run it. Anything outside that list (spending beyond ₹10,000, raising a cap, deleting a resource, a push to the public origin) is not approved: ask.
3. Run it. New Cloud Run revisions deploy with `--no-traffic`, are verified on their tagged URL, and only then do you propose moving traffic; moving live traffic is covered by the standing approval only after the ARC-M8-05 release gate is GO and the founder acceptance script has passed on that revision; before that, ask. Keep the current live revision (`momentum-00023-yaz`, rollback `momentum-v2be-8`) until the replacement passes the release gate. Never delete a resource.
4. Read the result back, record it with the date, update STATUS.

Pending cloud steps are listed in `queue.md` (the pitch secret, `GEMINI_BUDGET_LIMITS`, the `job_sheets` column, the labelled views, demo-day scaling, the billing budget, the release candidate deploy, the BigQuery dry-runs for ARC-M4-01).

## 6. Escalate to the founders

Ask, one question at a time with options and a recommendation, only for: a founder decision (scope, money, a new risk), anything that needs Om, moving live traffic before the release gate has passed, spending beyond the estimate (budget: ₹10,000; daily caps ₹600 and ₹200), and a NO-GO you cannot fix in three rounds. The standing approvals in `handover/PERMISSIONS.md` already cover the routine cloud steps. Check `external/decisions-and-defaults.md` first: if a default is written for the situation, apply it and record that you did, rather than asking again.

## 7. Pitfalls already met (each cost a round)

- A hook rejects the words "Claude", "Codex" or "Copilot" in a commit subject and the banned phrases in any committed text (including docs that list them).
- Builders cannot commit (`.git` is read-only in their sandbox) and cannot start servers; ports of tests are per-run, but two Playwright runs share port 4182.
- `npm test` hangs if another session left a `node --test` process holding a server: use `ps` before running; per-run ports remove most clashes.
- Reviewers' counts differ from yours when they cannot run server tests: give them your logs.
- A builder that cannot resolve one finding because it conflicts with a record may stop the whole packet: the fix packet must say to fix the rest and report the conflict.
- Builders edit STATUS.md "helpfully": remove such edits before applying the plan.
- A branch stacked on an unmerged branch needs a rebase onto `arc/main` after the parent merges; the apply tool does not do it.
- Do not let a test that needs a browser go unrun: the two stale browser specs after ARC-M1-10 went unseen because Playwright was NOT RUN at the M1 gate.
- The `/api/arc/turns` typed path stays `SERVICE_UNAVAILABLE` until the answer writer (ARC-M2-05) is wired; do not call a ticket done on a path that is not wired end to end.
- Wording of user-facing text, Hindi patterns and the missing-state screens need a human reviewer (founders or Om): keep them flagged and do not merge the dependent UI states until approved.

## 8. Usage limits

Both the Claude and the ChatGPT accounts have limits that stop all sessions for hours (ChatGPT: reset time is printed in the session log). Plan for it: keep the queue's next two packets written in advance, back up work in progress, and prefer the other tool for the gap if the founders allow it. If every tool is limited and the date is within seven days of the finals, work only on the pitch path:

1. J1 end to end in Arc (read order, match catalog, conditions, plan, explain, draft, human approval, PDF): ARC-M2-05 to M2-07, ARC-M3-01, ARC-M3-02, the J1 screens (ARC-M6-03) and the Arc panel (ARC-M6-02).
2. The data answers the pitch needs (ARC-M4-03, ARC-M4-04) and the "insufficient data" and refusal screens (ARC-M6-04).
3. The scripted deploy, demo-day scaling and the runbook (ARC-M8-01 to M8-03), the founder acceptance run (ARC-M8-04) and the release gate (ARC-M8-05).
Cut, in this order, and record every cut as a decision: Tier B pages in `web/` that are not on the pitch path (M6-06 groups beyond Main and New Lot), the missing states G1 to G17 beyond the ones J1 needs, photo upload (M5-02), defect history (M5-03), the P1 and P2 tickets, then Phase B. Never cut the human approval step, the labels, the budget caps or the QA of risky tickets.

## 9. Definition of done for a ticket

Merged on `arc/main` with the suite green on the merged result; acceptance criteria each covered by a test that was seen to fail; independent QA done where Tier A; findings fixed or carried to a named ticket; labels and numbers traceable to a source; nothing hard-coded or local-only in a product path (live Google Cloud services are used, fakes only in unit tests); live checks recorded as NOT RUN with the ticket that owns them; STATUS updated; the backup refreshed.

## 10. If the orchestrator is a Claude Code session

The role agents in `.claude/agents/` are the builders and reviewers; they load as subagents (the `Agent` tool, `subagent_type` set to the role). They run on the same machine without the Codex sandbox: they can commit (the hooks run), start servers and run the full suite. So the loop is shorter: no commit plan, and the builder runs `npm test` itself; you still run the suite on the merged result.

| Step | With Claude subagents |
|---|---|
| Builder | `Agent` with the role (for example `backend-engineer`), `run_in_background: true`, a prompt that points at the packet (`docs/arc/delivery/external/packets/<ticket>.md`), `CLAUDE.md` and `known-findings.md`, names the branch and worktree (create it with `tools/orchestrator/new-worktree.sh`, or tell the agent to), and says to commit in small commits, check `ps aux \| grep "[n]ode --test"` before test runs, and never kill other sessions' processes |
| QA and reviewers | `Agent` with `qa-lead`, `code-reviewer`, `security-reviewer`, `ai-evals-reviewer`, `responsible-ai-reviewer`, `compliance-reviewer`, `copy-editor` or `verification-auditor`; read-only on the branch under review, in a scratch worktree; the report format of `external/README.md` section 6 |
| Gate | `/review-gate <n>` (the number only: the command writes "M" in front, so "M1" produced a file named MM1), or start the eight yourself in one message |
| Resume a stopped agent | `SendMessage` to its id; its work is saved. An agent that stopped on a usage limit (HTTP 429) continues after the reset time printed in its notice |
| Outside sessions (optional) | `tools/orchestrator/codex-session.sh` when the Codex CLI is installed; see sections 3.2 and 3.3 |

Pitfalls specific to Claude subagents:
- A subagent returns one final report. Tell it to put the verdict and the numbers in that report. A notice saying it is "waiting on its own background work" may mean the report did not arrive: ask it to resend the verdict, or start a fresh one with the same brief.
- An agent started with worktree isolation can begin on an old base. Tell it to run `git switch -C <branch> arc/main` first (or make the worktree yourself) and to confirm `git log --oneline -3`.
- Never use `pkill -f "node --test"`: it kills other sessions' runs. Stop only your own processes.
- Do not let two agents share one worktree or run Playwright at the same time (port 4182).
- Brief every agent as a colleague who has not seen this conversation: the ticket, the files, the rules that matter, what was already decided, the report format and its length. A short command-style brief gives shallow work.
- A reviewer must be a different agent from the builder. For a fix, resume the builder and re-check with a reviewer (a new one for a full second QA).
- Keep your own context small: read reports, not transcripts; do not tail agent output files.

