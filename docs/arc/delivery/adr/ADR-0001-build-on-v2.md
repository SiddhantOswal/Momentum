# ADR-0001: Build Arc on the v2 code base

Status: Proposed
Date: 2026-11-22
Author role: solutions architect
Original branch: `arc/m0-discovery` (now on `arc/main`)

## Context

Two code bases exist.

- **v2** (this repository, branch `v2`): Node 20 and Hono backend (`index.mjs`, `src/`), BigQuery SQL and BigQuery ML models (`sql/`), React 19 and Vite app (`web/`), 78 test files run with `node --test` and Playwright, and a `quality` CI workflow. It is the live Momentum service on Cloud Run, it calls Gemini on Vertex AI in `asia-south1`, and it already holds every command Arc needs for journeys J1 to J8 in `02-product-spec.md` (`/orders/extract`, `/jobs`, `/jobs/:id/approve`, `/jobs/:id/card.pdf`, `/evidence/*`, `/conditions/weather`, `/impact/summary`, `/api/status`).
- **The Codex work** (separate local repository at `~/Singapore 2026`, remote `UstaadAI`): last commit 2026-10-03, with many uncommitted changes since. It holds five things:
  - `backend/`: a Python 3.12 FastAPI service for "Ustaad AI", a machine-maintenance assistant (incidents, repair cards, manual search). It is not a packaging product.
  - `frontend/`: a React 18 app for the same maintenance product.
  - `gemini-api-client/`: a small Node example that calls the Gemini Developer API with an API key.
  - `momentum-atelier/`: a git worktree of the Momentum repository at commit `f4d073b` (2026-10-21). That commit is an ancestor of `v2`.
  - `design/`, `docs/`, `research/` and about 20 root planning files: HTML design prototypes, strategy notes and audits.

Arc must call the same backend commands as the dashboard, keep one source of truth, use only Gemini on Vertex AI, and keep state in Firestore (CLAUDE.md sections 4 and 6; product spec section 1.4). About 12 days remain before the pitch.

Audit method: read-only. Files were listed and read, and `git log` and `git status` were run. Nothing in the Codex directory was written, installed, built or run. Two `.env` files exist there (`backend/.env`, `gemini-api-client/.env`). They were not opened.

Findings that shape the decision:

1. **Model provider.** The Python agent accepts three providers: `mock`, `vertex_ai` and `gemini_api` (Developer API, key from `GEMINI_API_KEY`). `gemini-api-client/` calls only the Developer API endpoint. Neither the `gemini_api` provider nor the client is allowed under the competition rule. The defaults also differ from the live service. The Codex agent uses `gemini-3.8-flash` and a preview critic model, `gemini-3.1-pro-preview`; v2 runs `gemini-3.5-flash`.
2. **Logic in the model.** The Codex agent keeps decisions in code. It runs a deterministic gate, accepts only citation IDs that a tool returned, and checks that the model's final answer matches the tool result. Its impact figures come from code and are labelled ILLUSTRATIVE with the formula attached. One gap: a second Gemini call, the critic, judges claim support. That doubles the Gemini attempts per answer against v2's shared cap of 100 a day.
3. **State.** The Codex state is held in memory, in SQLite (`backend/data/ustaad.sqlite3`) or in Postgres through SQLAlchemy. None of these is Firestore. A Postgres store on Google Cloud would mean adding Cloud SQL.
4. **Tests.**
   - `backend/tests/` holds 70 `unittest` cases in 5 files. `app/eval_harness.py` has 12 offline eval cases, all maintenance-safety refusals.
   - The only evidence of a run is compiled `.pyc` files from 6 and 7 October, built under Python 3.13 although the project requires 3.12. No result record exists, and the working tree has changed since then. The tests' current state is UNKNOWN. I did not run them.
   - `.github/workflows/ai-benchmark.yml` is untracked, so it has never run in CI.
   - `momentum-atelier/test-results/.last-run.json` records a passing Playwright run on 2026-11-15, but against the October snapshot, not v2.
   - `frontend/` has no tests.
5. **Overlap with v2.** v2 already has these parts:
   - a bounded Gemini function runner (`src/google-cloud/gemini-function-runner.js`: 8 rounds, 12 tool calls, 256 KiB result cap) and a tool list (`AGENT_TOOLS` in `src/trace-registry.js`);
   - Firestore idempotency and attempt-counter stores;
   - mock agents (`src/mock-agents.js`);
   - demo and Firebase supervisor auth, and locales.

   v2 lacks an Arc eval suite, durable traces (`src/trace-registry.js` keeps runs in an in-memory `Map`) and durable PO review state (`src/purchase-order-review.js`, also an in-memory `Map`).

## Decision

Build Arc on v2. Do not add a Python service, and do not run the Codex backend. Port only the ideas marked KEEP or REWORK below, rewritten in v2's Node, Hono and React stack, one ticket at a time, each through the normal review gate. Nothing from the Codex directory is copied into this repository as code, data or docs.

| # | Codex item | Verdict | Reason |
|---|---|---|---|
| 1 | Check that the final answer equals the server-validated tool result (`_validate_gemini_draft`) | REWORK | Direct basis for numeric fidelity (O7): reject any Arc reply whose numbers or IDs differ from the same turn's tool output |
| 2 | Citation allowlist: the model may cite only source IDs returned by tools in this turn | REWORK | Grounding and provenance (O7, O8); carry the labels from command responses, never from model text |
| 3 | Deterministic gate runs first, and a later check can only make a verdict stricter, never relax it | REWORK | Good ordering rule for Arc's reply checks; implement it as code in the Arc turn command |
| 4 | Second-model critic call (`gemini-3.1-pro-preview`) | DROP | One extra Gemini attempt per answer against the 100-a-day cap (C8), and a preview model; the deterministic checks in rows 1 to 3 cover the pitch scope |
| 5 | Offline eval harness: cases with expected verdict and expected tool sequence, run on the mock provider with no model calls | REWORK | Arc has no eval suite; rebuild as `node --test` suites for grounding, refusal, bypass, PO injection, numeric fidelity and labels (O4 to O9, Q5 offline mode) |
| 6 | Eval case content (12 maintenance-safety cases) and `benchmark_catalog.py` | DROP | Wrong domain; the catalog is a written spec with no executable cases |
| 7 | CI job that runs the offline evals on every push (`ai-benchmark.yml`) | REWORK | Add an offline eval step to v2's existing `quality.yml`; no second workflow |
| 8 | Mock provider that walks the same tool list as the live model | KEEP | v2 already follows this in `src/mock-agents.js`; extend it to Arc's tools so the evals need no Gemini attempts |
| 9 | Regex prompt-injection tripwire and NFKC text normalisation | REWORK | Useful only as a logged signal on PO text; the real control is structural (no approve tool, PO text treated as data; spec 3.3, 3.4) |
| 10 | Multilingual prohibited-phrase list (`safety_gate.py`) | DROP | Machine-safety phrases for maintenance work; Arc's scope rule is enforced by intent routing and tool absence |
| 11 | Per-turn tool trace with status, summary and source IDs | REWORK | v2 has `trace-registry.js` in memory; move it to Firestore under the state ADR, keeping v2's record shape |
| 12 | Metric carries a label and its formula (`impact_model.py`) | REWORK | Same idea as provenance labels in spec section 5; add a label field to Arc-facing responses. The maintenance savings model itself is dropped |
| 13 | Explicit opt-in flag before live model calls (`GEMINI_API_LIVE_CALLS_ENABLED`) | DROP | v2 already gates cost with the Firestore daily cap and the hackathon config |
| 14 | `gemini_api` provider and `gemini-api-client/` (Developer API, API key, axios) | DROP | Breaks the Gemini-on-Vertex-AI-only rule; v2's `vertex-gemini-client.js` uses the service identity |
| 15 | In-memory, SQLite and Postgres stores (`store.py`, `postgres_store.py`) | DROP | Not Firestore; Postgres would add Cloud SQL with no gain over v2's Firestore stores |
| 16 | Auth: demo login, Firebase, admin users, access audit (`auth.py`, `demo_auth.py`) | DROP | v2 has `hackathon-demo-auth.js`, `firebase-supervisor-auth.js` and the approval audit |
| 17 | Manual PDF ingest and lexical search (`manual_ingest.py`, `manual_search.py`) | DROP | Maintenance manuals are outside Arc's scope |
| 18 | `live_smoke.py` live check | DROP | v2 has `tools/test-gemini.mjs` and `tools/accept-gemini-counter.mjs` |
| 19 | Client outbox with a client-generated ID for idempotent create (`frontend/src/data/outbox.ts`) | REWORK | The client ID idea fits Arc turn and job idempotency keys; v2 already has `job-idempotency.js`, so reuse its key format. No offline queue |
| 20 | Speech capture (`speech_recognition` evidence lane) | DROP | Voice stays disabled in code (C7) |
| 21 | Frontend app, CSS tokens and locales (`App.tsx`, `styles.css`, `locales.ts`) | DROP | Maintenance UI on React 18; the approved designs in `docs/arc/design/` and v2's Tailwind setup govern |
| 22 | `momentum-atelier/` committed code | DROP | Ancestor of `v2` (`f4d073b`); v2 supersedes every module in it |
| 23 | `momentum-atelier/` uncommitted carton illustration (`src/ui-artwork.js`) and CSS edits | DROP | Not in the approved designs; raise with the designer if it is wanted |
| 24 | `design/` HTML prototypes (Atelier, Signal) and screenshots | DROP | Superseded by the approved designs in `docs/arc/design/` |
| 25 | Python `Dockerfile`, `DEPLOYMENT.md` | DROP | v2 has its own `Dockerfile` and `ops/cloudbuild-private.yaml` |
| 26 | `docs/` audits (critic design, adversarial safety, human-in-the-loop governance) | DROP | Maintenance-specific; their useful rules are captured in rows 1 to 5 and 9 |
| 27 | Root strategy, award and mock-judging files, `research/`, `submission/` | DROP | Strategy and competitor material; treat it like `docs/arc/reference/` and keep it out of the public repository |

## Consequences

- **No new service.** No Cloud Run service, database or provider is added. Cost per day at demo load stays as it is today. Gemini attempts per lot stay within the J1 ceiling proposed in the spec (3 attempts, not measured), because row 4 is dropped.
- **Work moves to tickets.** Rows 1, 2, 3, 5, 7, 9, 11, 12 and 19 become tech-lead tickets with a backend or AI owner. Rows 5 and 7 come first, because the M1 review gate needs eval pass rates (CLAUDE.md section 5).
- **Failure modes.** The main risk is that a ported idea behaves differently in Node than in Python. Each port gets its own `node --test` cases written against the spec's acceptance criteria, not against Python behaviour. If a reply fails the check in row 1, the Arc turn returns a "could not verify" state and makes no retry Gemini call, so the cap is protected.
- **Debt left in place.** Traces and PO review state are still in memory. This ADR does not fix them; a separate state ADR covers Firestore with transactions and idempotency keys.
- **Rollback.** This ADR changes no deployed resource. Each ported ticket is a separate commit on a feature branch, reverted on its own if its review fails. The live revision is untouched until the release gate.
- **Credibility.** Nothing from the Codex tests counts as evidence for Arc. Their state is UNKNOWN, and they test a different product.

## Alternatives rejected

1. **Adopt the Codex backend as Arc's backend.** Rejected. It serves a different domain, so every Momentum command would have to be rewritten in Python. That creates a second source of truth for planning, cost and approval, which breaks the rule that Arc calls the same commands as the dashboard. It also brings a non-Vertex provider path and a non-Firestore store, with test results UNKNOWN.
2. **Run both side by side** (Python Arc service calling v2 over HTTP). Rejected. It means a second Cloud Run service, a second deploy and IAM surface, and cross-service latency inside the 60-second request timeout (C10). Both services would also draw on one Gemini cap. The only gain is reuse of Python agent code, and that code is about 850 lines of maintenance-specific logic whose useful parts are listed above.
3. **Port the Codex frontend for Arc's side panel.** Rejected. It is a React 18 maintenance UI that matches none of the approved Arc designs. v2's `web/` app is React 19 and is the base the designs are being built on.
4. **Ignore the Codex work entirely.** Rejected. The tool-result equality check, the citation allowlist, the strictest-verdict rule and the offline eval pattern fill gaps v2 has for O4 to O9 and cost nothing to adopt as ideas.
