# Decisions made and defaults for open items

The full record with dates is the decision log in `docs/arc/delivery/STATUS.md`. This file groups it by topic so that an orchestrator can find the rule fast, and gives a safe default for every item still open, so no one has to stop and ask. Apply a default, record in the decision log that you did, and tell the founders in the next update.

## Decided (the founders, unless marked)

**Scope and plan.** Plan approved for Phase A (M0 to M8, release candidate 30 November 2026, finals 3 to 5 December, pitch 4 December) and Phase B (M9 to M14, after the finals). Every approved page ships, dark and light, built as designed (Q7). The UI is built exactly as the approved screens; UI elements with no backend show the designed "not connected" state and are listed (U1 to U14); backend features missing from the UI are listed (B1 to B11) for a founder decision and are never added to the UI by an agent. Display type is plain Inter (matches the approved PNGs), not Inter Tight.

**Product rules.** Arc never approves: the final job-card approval is a human checkbox plus the Approve button, labelled as a simulated demo-session approval. Gemini on Vertex AI only for generative work; deterministic logic in code and SQL. Gemini writes the answers to typed data questions, code checks every number and ID, and a template answer is the fallback (A3). Typed text costs 1 router attempt plus 1 writer attempt for a data question; chips and buttons cost 0. Router model: gemini-3.5-flash-lite in asia-south1 (A1, A2). The mic button is shown and disabled.

**Data and figures.** PKBX0041 stays the reference lot with the honest m2 re-run figures, labelled a model estimate, pending Om's sign-off: 7.3% moisture, 42.0% RH, 18.5 °C; 62.9 to 55.1 kg, 7.8 kg and ₹421 lower. Paper moisture is pre-filled at 7.3% as an "Example" and always editable. The plant is in Pune; weather comes from the weather API labelled "public weather record, not a plant sensor". No sensor feed exists. Current model R²: 0.468, 0.519, 0.388, 0.640, 0.108 (holdout, modeled lots). README, `DEMO_LOT` and the design files keep their old figures until Om signs off (ARC-M6-09, ARC-M6-19). A defect-history question is answered by the `query_metric` metric `defect_history_at_humidity`.

**Money and cloud.** Budget ₹10,000 of 25,000 in credits; daily rupee caps ₹600 on `momentum` and ₹200 on the eval pool, with attempt limits alongside; billing budget alerts at 50, 90 and 100 percent (ARC-M8-02). `momentum` has its own `budget_counters`; the old `prepagent` service stays on, unchanged. The 80-attempt pitch reserve covers all of 4 December SGT and only a pitch claim can spend it. Cloud Run: min 1 and max 6 to 2 December, min 2 on 3 and 4 December, min 0 and max 4 from 5 December. Live revision `momentum-00023-yaz` stays until the replacement passes the release gate.

**Privacy.** Stored PO reviews keep the 24-hour retention. Old drafts become read-only (F5). The photo retention period is open (see below).

**Process.** Per ticket: packet, builder, commit plan, two suite runs, QA for risky tickets, merge, record. QA tiers A and B (`external/README.md` 2a). The eight-reviewer gate at every milestone. Builders and reviewers are Codex sessions (`gpt-6.2-sol`, medium, no network); the Claude Code session orchestrates; Copilot takes small tickets. Nothing is pushed; `arc/*` is never pushed to the public `origin`; backups are git bundles in `momentum-backups/`. Thresholds T1 to T14 in `responsible-ai.md` are signed; an agent never changes them.

**Tech-lead decisions taken during the build** (full text in STATUS): a history page of N reads at most N + 1 documents; a replayed Gemini reservation never calls the provider twice; restart behaviour follows the ticket AC (same effect key, no second attempt, fail closed with `GEMINI_CALL_REPLAYED` when no stored effect exists, until ARC-M2-06 adds the durable effect store); cross-session access to Arc data is 404; safety-block code is `GEMINI_SAFETY_BLOCKED`; the contract D1, D3 and D5 choices in `06-arc-wire-contract.md`.

## Standing approvals

On 2026-11-24 the founders granted the orchestrator standing permissions and approvals so that it stays unblocked: `handover/PERMISSIONS.md` lists what is granted and what is not. Where this table says "approved in principle", that file applies.

## Open items and the default to apply

| Item | Who | Default until answered |
|---|---|---|
| Om's sign-offs (ARC-M0-04): reference lot, weather as a floor stand-in, 7.3% example, headline wording, ~19 °C. Needed by 26 November. | Om, via the founders (`data/om-signoff-request.md`) | Keep the reference case hidden from demo screens; show only live plan results; labels stay as decided; do not edit README, `DEMO_LOT` or the design figures (ARC-M6-09, ARC-M6-19 wait). If Om has not answered by 28 November, tell the founders and propose showing live plan results only in the pitch. |
| Location of `sid_pack.zip` (the lot generator, ARC-M0-05) | Founders | Record BLOCKED. It is not on the pitch path. Describe the modeled lots as modeled, seed 20261010, generator not in the repository. |
| Pitch slot time | Founders | The 80-attempt reserve covers all of 4 December SGT. |
| Create the secret `arc-pitch-reserve-code` and set `GEMINI_BUDGET_LIMITS`, then the live check of the session and IP limits (ARC-M1-17, ARC-M1-28) | Approved in principle (`handover/PERMISSIONS.md`) | Do it, with the change record first, on a tagged no-traffic revision; never print the secret value. |
| The read-only BigQuery dry-runs in `data/arc-metric-dry-runs.md` (ARC-M4-01; they include the changed `seen_before.sql`) | Approved in principle (`handover/PERMISSIONS.md`) | Run them, record the bytes billed, then enable the metrics. |
| Approve the missing UI states G1 to G17 (screenshots, D4) | Founders | Draft each state from the approved tokens, save the screenshot under `docs/arc/design/additions/`, mark it "pending approval", and do not merge that state (ARC-M6-18) until approved. |
| Hindi approval patterns, suggestion and clarification labels in `config/arc-scope.json` need a native-speaker review | Founders, Om | Keep them flagged "unreviewed" in the ticket; claim English coverage only. |
| Backup remote | Founders (push approval is standing once they name a private remote) | Local git bundles only. Never use the public `origin`. If the founders create a private repository, add it as a second remote named `backup` and push `arc/*` after each gate, with their approval for each push. |
| Photo retention period (ARC-M5-04) | Founders | 7 days with a TTL, as for the other stored records, until decided. |
| Phase B dates and plant profile (D5) | Founders | Phase B stays unstarted until the finals are over. |
| The founder acceptance run (ARC-M8-04) | Founders (optional) | The orchestrator runs the 17 steps itself, in a browser, on the tagged revision, records `reviews/acceptance-<date>.md` labelled "run by the orchestrator", and does not wait for a manual founder run. |
| The CLAUDE.md nits ("Nucleas", a blank line, "V2") | Founders | Leave as they are. |
| The commit author email before the first push | Founders | No push, so nothing to do. |
| Node 22 for ARC-M1-13 | Approved (installing tools is standing) | Install Node 22 when the P0 work allows, record a Node 22 run of the weather test, and close the ticket as not reproducible if 10 full runs pass. |
| Editing `scripts/quality/` for ARC-SETUP-02 | Approved (standing, never to weaken a check) | Do it as a Tier A ticket with an independent QA, and record it in STATUS. |

## What counts as a founder question

Only the items above that have no default, a request to spend beyond the estimate, moving live traffic, anything that changes what the pitch claims, and a NO-GO that survives three repair rounds. Everything else has a rule here, in `CLAUDE.md`, in the plan or in the decision log.
