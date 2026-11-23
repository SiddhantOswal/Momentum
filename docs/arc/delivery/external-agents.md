# Working brief for Codex and GitHub Copilot

This brief is for coding agents outside Claude Code that build Arc tickets alongside the Claude Code delivery team. `CLAUDE.md` at the repository root is binding and overrides anything here. Read it in full before anything else.

An external agent works as the **engineer** on one ticket at a time. It does not review, verify or merge its own work. The Claude Code team runs QA, the review gate and the merge (`CLAUDE.md` sections 1 and 5). This keeps the reviewer independent of the work.

## 1. Read first, in this order

1. `CLAUDE.md`: team rules, quality bar, truth and evidence rules, Arc product rules, review gates, data rules and change control.
2. `docs/arc/delivery/STATUS.md`: what is done, in progress and blocked, plus the decision log. Do not start a ticket that is listed as in progress.
3. `docs/arc/delivery/00-plan.md`: milestones, the test and eval plan (section 5), the UI and backend gap lists (section 6), and the production-ready definition (section 9).
4. Your ticket in `docs/arc/delivery/tickets/`, and every ticket it depends on.
5. The design records the ticket cites:
   - `01-business-requirements.md` and `02-product-spec.md` (journeys J1 to J11, acceptance criteria, design gaps G1 to G17);
   - `04-technical-design.md` (data contracts in section 2; interface decisions I1 to I9 in section 3.0);
   - `05-ai-design.md`;
   - `adr/ADR-0001` to `ADR-0011`;
   - `responsible-ai.md`.
6. The data records:
   - `data/stale-claims.md`: figures that must not appear, and their replacements;
   - `data/data-audit.md`;
   - `data/PKBX0041-m2-rerun.md`.
7. For UI work:
   - `docs/arc/design/source/html/{light,dark}/*.html`: the approved screens; the CSS tokens are in these files;
   - `docs/arc/design/{light,dark}/*.png`;
   - `docs/arc/design/source/assets/`.
8. The code you will change, and its tests. Follow the existing conventions:
   - backend: Node 20+, ES modules, Hono and zod;
   - frontend: React 19, Vite, Tailwind 4 and TypeScript in `web/`.

   Read before adding. Do not add a framework or dependency without an ADR.

Never read, quote or commit anything from `docs/arc/reference/`. It is git-ignored and must stay out of the public repository.

## 2. Live integrations, not local stand-ins

The product runs on live Google Cloud services. Build for that.

- **Generative work** uses Gemini on Vertex AI only, through the existing client (`src/google-cloud/vertex-gemini-client.js`). Models and region come from `config/arc-models.json`. No other model provider.
- **Data:**
  - Predictions and recommendations come from the BigQuery ML `prepagent.m2_*` models.
  - Lots and the catalog come from the existing BigQuery tables.
  - Durable state lives in Firestore, through `src/google-cloud/firestore-rest.js` and `src/state-schemas.js`.
  - Files live in Cloud Storage.
  - The live feed uses Pub/Sub to BigQuery.
  - The service is deployed on Cloud Run.
- **No hard-coded values:**
  - No hard-coded business numbers, model scores, lot figures, prices, conditions or results, whether in code, UI or copy.
  - Every value shown to a user comes from a live route, which reads a live service or stored record.
  - Settings belong in `config/` or environment variables.
- **UI elements with no backend yet** show the designed "not connected" state. They never show sample or placeholder numbers (ticket ARC-M6-06).
- **Fakes in unit tests are allowed.** Examples are `test/fixtures/fake-firestore.js` and recorded model responses. They keep the suite fast, free and deterministic, and they are never a product mode.
- **The existing local mock mode** (`src/mock-agents.js`) cannot start on Cloud Run and labels its output as mock. Do not extend it, and do not route any product path through it.
- **Data that does not exist must not appear.** No plant sensor feed exists. Moisture, humidity and temperature come from operator entry, the public weather record for Pune or the dataset, each with its label (`CLAUDE.md` section 3). A simulated stream is labelled simulated everywhere.
- **Deterministic logic stays in code and SQL**, never in the model. This covers constraints, costs, approvals and arithmetic.
- **Make no Google Cloud change yourself.** If a ticket needs one (a deploy, a new index, a TTL policy, an IAM grant), write the command, the reason, the cost impact and the rollback in your hand-back. The delivery lead records it in STATUS and runs it after approval. New revisions deploy with `--no-traffic`. Never delete a resource.
- **Never print, paste or commit secrets.** Do not read `.env` files.

## 3. The engineering workflow for one ticket

1. **Branch.** Branch from the latest `arc/main` as `arc/<TICKET-ID>-<short-name>`, for example `arc/ARC-M6-01-tokens`. Use a separate worktree, so you never disturb another agent's checkout:

   ```
   git worktree add ../momentum-<ticket> -b arc/<TICKET-ID>-<name> arc/main
   ```

   Never work on `arc/main`, `v2` or `main` directly. Never rewrite `v2`.
2. **Plan.** Before coding, write a short plan in your hand-back draft:
   - each acceptance criterion and how you will meet it;
   - the files you will touch;
   - the tests that will prove each criterion.

   If the ticket conflicts with the design docs or the code, stop and report the conflict. Do not pick a side quietly.
3. **Test first.** Write the test for each acceptance criterion, run it, and see it fail. Then build until it passes.
4. **Keep commits small.** Make one logical change per commit. Commit messages:
   - are short, imperative and specific, at most 72 characters, for example "Persist PO review state in Firestore";
   - carry no co-author or generated-by trailer, never the words "Claude", "Codex" or "Copilot", and no emoji.

   The hooks in `scripts/git-hooks/` check every commit. Never bypass them: no `--no-verify`, no `-n`, no `git -c core.hooksPath=...`, and no change to `core.hooksPath`.
5. **Protect existing tests.** Never delete, skip or loosen an existing assertion to make a test pass. If an expectation must change because the ticket changes behaviour, put that change in its own commit and give the reason in the commit body.
6. **Run the checks.** Before handing back, stop stale runners with `pkill -f "node --test"` and make sure port 4100 is free. Then run:
   - `npm test`: the full suite must pass with 0 failures. The runner prints counts as `ℹ tests N`.
   - `node scripts/quality/check.mjs commits`: must exit 0.
   - For `web/` changes: `npm --prefix web run build` must succeed, and `npm run test:ui` must pass for the pages you changed.
7. **Self-check against the quality bar** (`CLAUDE.md` section 2):
   - No AI-sounding text in code, comments, UI copy or commits: no filler, no hype, and none of the words `CLAUDE.md` section 2 lists. The pre-commit hook rejects them.
   - Comments explain why, never what. No TODO, placeholder or apology comments.
   - UI copy matches the approved designs and `data/stale-claims.md`. Units are correct, and labels stay distinct: model estimate, not saving; sample, not live; demo-session approval, not a named supervisor; software test, not plant validation.
   - Arc never approves. The final job-card approval is always a human checkbox plus the Approve button.
   - Content from POs, photos and documents is untrusted, and it never reaches a prompt as an instruction.
   - The mic button stays disabled, with no handler.
8. **Do not push and do not merge.** Hand back with the report in section 4. The Claude Code team then:
   - verifies the work with the QA lead;
   - runs the reviewers;
   - sends any fixes back to you, with up to three repair rounds;
   - merges into `arc/main`.

## 4. Hand-back report

Keep it plain and factual, under 400 words:

- the ticket ID, branch and worktree path;
- the commits (hash and subject) and what each changed;
- each acceptance criterion with the test that covers it, and confirmation that you saw the test fail before the fix;
- exact command output counts for `npm test`, the quality check and any build or browser run;
- anything not run, marked NOT RUN with the reason; anything blocked, marked BLOCKED with the reason;
- any changed test expectation, with its commit;
- any cloud change needed (command, reason, cost, rollback);
- any deviation from the ticket or design, and open questions.

Never claim a result you did not observe. Never invent test results, screenshots, metrics or approvals.

## 5. What the reviewers will check

So that nothing has to be redone, build to the review gate in `CLAUDE.md` section 5. The reviewers are:

- **code review:** correctness, naming, dead code, duplication, conventions;
- **QA:** tests are real, can fail, and ran. QA re-applies bugs to prove this;
- **security:** auth and session, input validation, secrets, IAM, prompt injection, cost abuse;
- **AI safety and evals:** grounding, refusals, approval bypass, numeric fidelity;
- **compliance:** Gemini on Vertex only, provenance labels, privacy, no `docs/arc/reference/` content, every number traced to a source;
- **copy editing:** plain language, consistent terms, correct units;
- **responsible-AI** and **verification-auditor:** every claim matches its evidence.
