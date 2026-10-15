# Requirements to code and GCP matrix

Static review of frozen source9edd78db…; imports alone are not integration proof. Live results are recorded separately. Google AI generates extraction, explanations and photo diagnoses. Deterministic orchestration dispatches bounded tools/SQL; this is not demonstrated autonomous planning. Historical similar-run retrieval is not durable episodic decision memory.

Component | UI/route/source | Call chain/service | Gate | Actual candidate acceptance action
---|---|---|---|---
Order intake/extraction | src/ui/workflow.js; index.mjs /orders/extract | order-extraction-service.js → storage-client.js → vertex-gemini-client.js → catalog SQL | Synthetic hash/MIME/size + signed session + shared counter | Browser approved PO upload; compare output, counter, logs, GCS metadata
Conditions | /conditions/current; src/google-cloud/conditions-service.js | BigQuery simulated PLANT-01 conditions | Explicit human confirmation; provenance | Browser DAY shift/load readings, manual entry, checkbox state
Prediction/optimization/explanation | /risk/*; src/service-ports.js; job-coordinator.js | Five BQML models; canonical optimizer SQL; Vertex explanation | Common model acceptance gate + confirmation | Actual negative calls while D4 blocked; no model invocation
JobSheet/approval/card | /jobs; /jobs/:id; approve; card.pdf | BigQuery repository + audit; job-card-service.js; GCS PDF | TEST namespace; signed actor; DRAFT transition; D4 | Session/namespace/approval negatives; full positive BLOCKED D4; retain isolated evidence
Feedback | /jobs/:id/feedback; linked-feedback-service.js | BigQuery TEST feedback | Session-owned valid JobSheet; no completed-lot writes | Invalid/cross-session route rejection
Photos/history | /evidence/approved-photos; classify-photo; seen-before | GCS allowlisted inventory + shared-metered Vertex; BigQuery history | 10 canonical objects; strict output schema | Browser inventory + one candidate-path classification; historical retrieval
Impact | /impact/summary; src/ui/dashboard.js | Four bounded BigQuery queries; one-hour cache | Generic labels; schema validation; simulation estimates | Browser dashboard rendering + API/cache and query metadata
Infrastructure/trace | /health; /api/status; /api/runs/:id/events | Cloud Run runtime; process-local trace registry | IAM distinct from demo session; no URL tokens | Browser status/navigation/console; negative trace access; mock endpoints denied

Official R01–R03 map to order/conditions/model/job workflow and Cloud Run; R07 to English UI; R13 to all runtime evidence. R04–R06 and R08–R12 require separate submission/team/rights artifacts, not API tests. Preserve D4 and canonical manufacturing semantics.
