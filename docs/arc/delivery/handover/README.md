# Handover: start here

This folder, with the rest of the repository, lets a new session on a new laptop take over the Arc delivery and continue exactly as it was run, with no access to the previous session.

## What the handover contains

The handover zip (`momentum-arc-handover-<date>.zip`) holds:

| Path | What it is |
|---|---|
| `START-HERE.md` | this file |
| `PROMPT-FOR-CLAUDE.md` | the prompt that starts the orchestrator session (a copy of `CLAUDE-ORCHESTRATOR-PROMPT.md`) |
| `NEW-LAPTOP-SETUP.md` | install, clone, hooks, tests and Google Cloud sign-in |
| `repo/momentum-arc.bundle` | the whole git repository: every branch (`arc/*`, `v2`, `main`) with full history, including unmerged work in progress |
| `private/reference-material.zip` | the V5 pack, source PDFs and strategy files: excluded from git, never to be committed or pushed (keep the zip private) |
| `TICKETS.txt` | every ticket merged or open, by priority, when the zip was built |
| `STATE.txt` | the output of `tools/orchestrator/resume.sh` when the zip was built |
| `MANIFEST.md` | every file with its SHA-256 and the git commit the bundle was built from |

Everything else is in the repository (`docs/arc/delivery/`): the rules (`CLAUDE.md`), the plan, requirements, product spec, designs, ADRs, tickets, change records, review files, data records, the status record, the runbook and the role prompts.

## Steps

1. Follow `NEW-LAPTOP-SETUP.md` (about 30 minutes).
2. Paste `PROMPT-FOR-CLAUDE.md` into Claude Code in the repository root.
3. The session reads the documents, reconciles `STATUS.md` with the repository, and continues the loop from `external/queue.md`: the M1 gate conditions, then ARC-M2-05 (the answer writer), M2-06 (event stream and resume), M2-07 (the eval harness), the M2 gate, then M3 to M8 and the release gate on 30 November.

## More in this folder

- `ENVIRONMENT.md`: the live Google Cloud environment, names only.
- `ROADMAP-TO-RELEASE.md`: day by day to the release candidate and the pitch.
- `TWO-MACHINES.md`: who writes what when two machines work on the repository (build lane and pitch lane).
- `SYNC-AND-PUBLISH.md`: commit everything, keep `arc/main` complete and push to the one repository (procedure and a paste-ready prompt).
- `GIT-WORKFLOW.md`, `PERMISSIONS.md`, `LIFECYCLE.md`, `NEW-LAPTOP-SETUP.md`, `settings.unblocked.json`.
- `node tools/orchestrator/ticket-status.mjs`: every ticket, merged or open.

## Reading order for a person

`CLAUDE.md`, `handover/LIFECYCLE.md`, `handover/PERMISSIONS.md`, `handover/GIT-WORKFLOW.md`, `docs/arc/delivery/STATUS.md`, `external/ORCHESTRATOR.md`, `external/decisions-and-defaults.md`, `external/queue.md`, then `00-plan.md` and the rest on demand.

## The one rule behind everything

Nothing is "done" unless it ran and was seen to pass. Every number traces to a source. Modeled is not measured, sample is not live, a model estimate is not a saving, a demo-session approval is not a named supervisor, and a software test is not plant validation. Arc never approves a job card.
