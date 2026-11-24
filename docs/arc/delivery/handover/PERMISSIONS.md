# Standing permissions and approvals for the orchestrator

Granted by the founders on 2026-11-24 ("fine with giving it all of the permissions, approvals and other things; it needs to stay completely unblocked"). They apply to the orchestrator session that continues this delivery, whichever tool it runs in, and to the builder and reviewer sessions it starts. They replace the "ask the founders for a yes" step for the items below. They do not remove any rule in `CLAUDE.md`, and every cloud change still gets its written change record first.

## Granted

| Area | Standing approval |
|---|---|
| Google Cloud project `prepagent-hack` | Run any change the delivery needs: enabling APIs, creating Secret Manager secrets and versions (never print a value), granting the narrowest IAM role (for example `secretAccessor` on one named secret), Firestore indexes and TTL policies, BigQuery tables, views and columns added next to the existing ones, Cloud Storage buckets and objects, Pub/Sub, billing budgets and alerts, Cloud Run revisions, tags, scaling and environment variables. Write the change record (`docs/arc/delivery/changes/<date>-<name>.md`: command, reason, cost impact, rollback) and put a line in STATUS before running it. No founder yes is needed per step. |
| Read-only and dry-run calls | Any `gcloud` describe, list or logging read, `bq ls`, `bq show`, `bq query --dry_run`, and real read-only `bq query` runs within the 50 MiB cap per query, including the ARC-M4-01 dry-runs in `data/arc-metric-dry-runs.md`. |
| Cloud Run deploys | Deploy with `--no-traffic` and a tag, verify on the tagged URL, then move live traffic to the new revision only when the ARC-M8-05 release gate has returned GO, the acceptance script (`00-plan.md` section 5.6, ARC-M8-04) has passed on that revision and a rollback to the previous revision is ready. The orchestrator runs the scripted steps itself in a browser against the tagged revision and records the result in `reviews/acceptance-<date>.md`, labelled "run by the orchestrator"; the founders' own manual run is welcome but is not waited for. The previous revision is kept. |
| Live Gemini and live checks | Live evals, the Vertex smoke call, the token and latency measurement and the live integration run (ARC-M1-28) on a tagged revision, inside the budget caps below, with results recorded as "eval run, not the live service". The PO-injection evals at significant milestone gates. |
| Money | Up to the ₹10,000 budget (F2): daily rupee caps ₹600 on `momentum` and ₹200 on the eval pool, the 80-attempt pitch reserve for 4 December SGT, the eval day limit of 900 attempts. Spending beyond that, or raising a cap, needs a founder yes. |
| Git | Create, rebase and delete local feature branches and worktrees that are merged and recorded; merge into `arc/main` with `--no-ff` after the checks in `ORCHESTRATOR.md`; push `arc/*` to a private backup remote the founders name, never to the public `origin`, never with `--force`. The exact branch model, merge steps and release tag are in `GIT-WORKFLOW.md`. |
| Tools and settings | Install tools the work needs (Node 22, Playwright browsers, Python packages for local scripts); edit `.claude/settings.json` or `.claude/settings.local.json` to allow commands the process needs; edit `scripts/quality/**` and `.github/workflows/**` when a ticket requires it (ARC-SETUP-02), never to weaken a check. Record each such edit in STATUS. |
| Decisions | Settle technical conflicts between documents as tech lead and record them in the decision log. Apply the defaults in `external/decisions-and-defaults.md` for every open item that needs a person who is not available (Om, the pitch organisers). |

## Not granted (these stay as `CLAUDE.md` and the plan set them)

- Deleting any production or cloud resource (Cloud Run services and revisions, datasets, tables, buckets, secrets, Firestore data).
- Pushing to the public `origin`, force-pushing, rewriting `v2` or Om's commits, committing anything from `docs/arc/reference/`, committing or printing a secret or credential.
- Bypassing a hook or a check: no `--no-verify`, no `-n`, no change to `core.hooksPath`.
- Spending beyond the budget, or switching Gemini off for the live service (people may still be using the product).
- Claiming a result that was not observed: NOT RUN and BLOCKED are honest results. Presenting modeled data as measured, a sample as live, a model estimate as a saving, a demo-session approval as a named supervisor or a software test as plant validation.
- Approving a job card on a user's behalf. Arc, the orchestrator and every agent never approve; a human ticks the checkbox and presses Approve.
- Anything that needs Om's judgement of plant realism (the PKBX0041 sign-off, weather as a floor stand-in): the defaults apply until Om answers.

## Making a Claude Code session unblocked on a new laptop

The repository's `.claude/settings.json` asks before pushes, deploys, creates and updates, and edits to the hooks, quality scripts and workflows, and denies deletes, force-pushes and hook bypasses. To run unblocked, copy `docs/arc/delivery/handover/settings.unblocked.json` to `.claude/settings.local.json` on that laptop (the file is not committed; it applies only there). It allows every shell command and file edit except the deny list, which keeps the hard limits above. Then start Claude Code in `bypassPermissions` mode (`claude --permission-mode bypassPermissions`) or accept the prompts once with "always allow". Deny rules still apply in either mode.
