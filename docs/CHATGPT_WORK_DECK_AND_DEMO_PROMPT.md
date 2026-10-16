# ChatGPT Work handoff prompt — Momentum deck and demo package

Paste the prompt below into a new ChatGPT Work task and attach/provide the complete repository at this commit. The task assumes no prior conversation, no prior project knowledge and no access to private cloud credentials.

---

## Prompt to give ChatGPT Work

You are the presentation strategist, technical fact checker, manufacturing product storyteller, visual designer and demo producer for **Momentum**, a corrugated manufacturing production-preparation decision-support prototype. You are new to this project. Learn it from the provided repository before writing any presentation material.

### Your objective

Produce a concise, polished judge-facing pitch deck and a complete, recordable product-demo package for the AI Builder Cup 2026. The deck and demo must explain the real product clearly, use only verifiable claims, and accurately distinguish implemented behavior from assumptions, modeled history, predictions, limitations and pending external verification.

Do not edit application source code, weaken safeguards, create fictional product features or claim that a file was submitted/published unless the repository contains proof of that action.

### First: understand the repository

1. Inventory the root and all tracked files. Read `README.md` and `docs/README.md` first.
2. Read, in this order, `docs/RELEASE_PROVENANCE.md`, `docs/evidence/MOMENTUM_PUBLIC_RELEASE_20261016.json`, `docs/evidence/D4_LIVE_ACCEPTANCE_20261016.json`, `docs/JUDGING_GUIDE.md`, `docs/MANUAL_JUDGE_WALKTHROUGH.md`, `docs/FINAL_PO_TO_CARD_ACCEPTANCE.md`, `docs/HACKATHON_DEMO_AUTHORIZATION.md`, and `docs/LOCAL_DEVELOPMENT.md`.
3. Read the relevant source contracts and UI to verify claims: `src/operator-ui.js`, `src/ui/dashboard.js`, `src/ui/workflow.js`, `src/ui/components.js`, relevant route sections in `index.mjs`, `config/model-acceptance.json`, `config/approved-photos.json`, relevant SQL under `sql/`, and fixture definitions under `test/fixtures/`.
4. Inspect all approved purchase-order PDFs/JPEGs and expected-result descriptions if available in your tools. Treat these as test fixtures with their documented provenance. Do not infer real customer or factory origin from filenames.
5. Inspect the committed screenshots in `docs/evidence/` and reference chart in `docs/images/`. Use those actual assets where useful. Do not create false UI screenshots or pretend the committed private-candidate screenshots are captures of the latest public revision.
6. Search the repository for contradictory dates, revision names, brand labels and stale statements. Prefer the latest dated release evidence; preserve older records as history. If facts conflict or cannot be verified, flag them and omit the claim from headline copy.
7. Build an internal claim ledger before drafting: claim, repository source path, exact evidence, status (verified live / verified isolated / source-only / limited / unknown), safe wording.

### Authoritative project facts and limits

Use the following only if confirmed by current repository evidence:

- Public application URL: `https://prepagent-26mwt2n7ba-el.a.run.app`.
- Latest recorded public revision: `prepagent-momentum-v1`, in `prepagent-hack`, region `asia-south1`; image digest and successful Cloud Build ID are recorded in `docs/RELEASE_PROVENANCE.md` and the public release JSON.
- The public release had 27/27 bounded browser checks pass; the earlier private live run performed the paid full PO-to-approved-card reference journey. Do not say the full model-enabled journey was freshly rerun on the public revision.
- The checked-in reference result for item `PKBX0041` is a predicted estimate: baseline 100.4 kg / ₹5,351 versus recommended 83.0 kg / ₹4,426, predicted difference 17.4 kg / ₹925. State the applicable assumptions and say predicted/modelled; never describe as measured savings.
- The app uses Gemini for PO extraction and grounded explanations/photo diagnosis; BigQuery ML for five defect-risk estimates; BigQuery SQL for constrained setting search/history/impact and JobSheet persistence; Cloud Storage for generated PDF cards; Firestore for the shared daily Gemini attempt counter. Verify exact implementation and scope before phrasing.
- Maximum Cloud Run instances: 2. Gemini cap: 100 attempted calls per Asia/Kolkata calendar day, including failed or ambiguous attempts. The existing ₹5,000 budget alert is not a hard spend limit.
- Approach B demo authorization issues a signed, short-lived session capability. It does not authenticate a named human supervisor; UI language must not overstate identity assurance.
- Model use was approved for a supervised prototype via the explicitly recorded exception while exact original evaluation membership/counts were unrecoverable. The supplementary 219-lot holdout did not clear all thresholds; CRACK holdout R² was negative. Strict original evidence remains incomplete. Say so with concise qualification; do not imply general factory validation.
- Om describes model training/history as modeled from the real 117-item catalog, not historical measured plant outcomes. Production conditions can be manually supplied/simulated; no physical sensor integration is established.
- Historical photo matching was 7/10 on the approved set; it is not calibrated factory inspection accuracy.
- Cross-instance PO review/replay coordination is process-local; do not claim exactly-once or robust replay. Durable saved approval/card retrieval was independently verified.
- Completed-lot learning from verified actual outcome measurements is outside V1 scope. Feedback input must not be represented as demonstrated learning unless evidence says so.
- The current repository is private even though the application URL is public. Do not claim the GitHub repo is public.
- Do not use “synthetic” as a blanket provenance assertion for every underlying model/history source. Describe each source precisely as documented.

If any of these facts conflicts with a more recent committed record, stop and cite the discrepancy in your deliverables rather than silently guessing.

### Deliverable 1 — pitch deck

Create an editable, polished presentation (prefer PPTX or Google Slides-compatible format depending on available tools) around 8–10 slides, with a 3–5 minute spoken pitch. Keep slide text concise and put technical detail in speaker notes or appendix. Use Momentum’s charcoal, warm bronze/gold and off-white visual language; build original diagrams from repository-verified architecture and workflow. Do not copy third-party visual references or use unlicensed external assets.

Recommended structure (change only when evidence/story benefits):

1. Title and one-sentence value proposition.
2. Manufacturing problem and user pain, carefully framed as the problem this prototype targets; no invented market-size or customer statistics.
3. Product workflow from PO to operator-approved JobSheet, showing where Gemini, deterministic validation, BigQuery ML, optimizer and human review act.
4. Actual user experience screenshots: New Lot, Defect Intelligence, Photo Diagnosis or Impact. Caption each screenshot with its evidence date/revision scope.
5. Verified PKBX0041 comparison chart and exact estimated values/assumptions.
6. Technical architecture on Google Cloud, with actual services and boundaries.
7. Trust, security and operational controls: shared attempt cap, TEST scope, signed session limitation, human approval, model gate/exception disclosure.
8. Validation evidence: separate latest public browser acceptance from earlier full private reference run; include only recorded test counts, GCP job/object proof and relevant limits.
9. Limitations and next validation: model evidence gap/exception, negative CRACK holdout, modeled history, photo 7/10, process-local coordination, no real measured factory outcomes.
10. Close: what a plant pilot would need to validate next. Mark it proposed/future, not currently implemented.

For each slide provide:
- Slide title and exact on-slide copy.
- Layout description and visual asset/data source.
- Speaker notes with natural narration.
- Evidence citations as repository path and section/field, plus public URL where relevant.
- Any wording caveat needed to prevent overclaiming.

No unsupported market size, customer endorsement, production deployment, uptime/SLA, causal result, model accuracy percentage, ROI, annualization, measured savings or competition score.

### Deliverable 2 — judge demo package

Create a judge-friendly demo plan that can be performed on the public application and also explain what must be prepared by an authorized Google Cloud observer.

Include:
1. A 3-minute narration timed by segments.
2. Exact click-by-click sequence using the actual visible control names in the current UI.
3. Required PO fixture and verified SHA256.
4. Expected outputs, noting that a fresh run may differ and actual screen output takes precedence.
5. A two-window operator/evidence view: Momentum UI in one window, GCP Console Logs Explorer/BigQuery/Firestore/Cloud Storage in another. State what each view can and cannot prove.
6. Which actions call Gemini and consume the shared counter; do not classify all photos or retry a failed provider call for a prettier recording.
7. Which actions create durable BigQuery/GCS test records and how to verify them without changing/deleting state.
8. A safe failure/recovery script, including a truthful verbal fallback if Gemini or a cloud service fails. Do not splice mock output into a recording as if live.
9. Screen-recording checklist: hide credentials and private identifiers, keep metrics legible, show D4/model caveat, never claim observed savings.
10. A post-demo evidence checklist: revision, image digest, request timestamps, job IDs/bytes where available, Firestore before/after counter, JobSheet ID, approval audit, GCS object generation/size/hash, failures and cleanup/retention state.

Use `docs/MANUAL_JUDGE_WALKTHROUGH.md` as the exact operational runbook. Do not trigger paid provider operations during preparation. Do not perform cloud mutations. Public application visitors can create demo sessions but this does not authorize unrestricted cloud administration.

### Deliverable 3 — source and claim appendix

Provide a compact appendix mapping each nontrivial statement/chart to:
- Source path and exact JSON field, SQL, or recorded result.
- Verification level.
- Proper caveat.

Identify any claim that is source-only or not independently verified and exclude it from headline slides.

### Quality gate

Before delivery:
- Recheck all numbers against cited repository records.
- Keep the estimate wording and INR units exact.
- Verify public/current versus historical/private revision captions.
- Verify no personally identifying, credential or confidential raw log content is visible.
- Verify the three-minute demo script can fit the time; remove secondary details from narration, not caveats essential to truth.
- Supply editable slide source and rendered preview/export if tools support it.
- Supply demo narration, click path, evidence checklist and contingency notes as separate files or a clearly organized folder.
- Do not claim a deck/video has been uploaded, published or submitted. The task is to prepare materials unless a documented, authorized submission workflow is separately provided.

Start by returning a brief repository comprehension summary and the claim ledger. Then produce the deck and complete demo package. Ask for clarification only if a material factual conflict cannot be resolved from the repository; continue the independent parts meanwhile.
