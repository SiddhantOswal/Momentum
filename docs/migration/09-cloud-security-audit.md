# 09 Cloud, AI and security audit

Method: static reading of `arc/main@cb1338f`, STATUS.md and reviews. `gcloud auth list` reports **no credentialed accounts** and no project, so nothing below is live-verified. Classification: configured (in repo), invoked (code path calls it), deployed (live revision), verified (live evidence). Only "configured/invoked" can be claimed from here.

## Google Cloud and AI inventory
| Service | Configured | Invoked in code | Deployed | Verified |
|---|---|---|---|---|
| Vertex AI Gemini (`gemini-3.5-flash`, `-flash-lite`, `asia-south1`) | `config/arc-models.json`, `gcp-vertex-ai.json` | `src/google-cloud/vertex-gemini-client.js` | live revision lacks M1 flags (STATUS) | 3 live calls HTTP 200 per STATUS (not re-checked) |
| Firestore (state, budgets, idempotency, traces, live store) | 13 TTL policies ACTIVE per STATUS | `firestore-*.js` | flag-gated, off on live | live NOT RUN |
| BigQuery / BigQuery ML (`m2_*`) | `sql/`, `config/` | read and write clients | yes (v2 on live) | R2 re-measured by data engineer per STATUS |
| Cloud Storage (photos, PDFs) | `config/gcp-storage.json` | `storage-client.js` | unknown | UNVERIFIED |
| Cloud Run | Dockerfile; limits only on the live service | n/a | `momentum` and `prepagent` | no deploy script in repo |
| Secret Manager | pitch reserve secret `arc-pitch-reserve-code` planned | `ARC_PITCH_RESERVE_CODE` read from env | not yet | NOT RUN |
| Pub/Sub | devDependency, sensor route | simulated stream only | unknown | UNVERIFIED |
| Cloud Build | `ops/cloudbuild-private.yaml` | n/a | unknown | UNVERIFIED |
| Gemini voice / Text-to-Speech | none | none | none | missing by plan (mic disabled) |
| Cloud Logging / Monitoring | no code evidence | default Cloud Run | unknown | UNVERIFIED |

## AI engineering (observed in code or reviews)
Strengths: Gemini-only rule (competition requirement); deterministic constraints stay in code and SQL; scope and approval rules before the model (0 attempts for chips); router sees IDs, numbers and enums only; tool registry with strict schemas and effect keys; replay guard prevents second provider call; `safetySettings`, `thinkingConfig`, `toolConfig` on every call; per-turn attempt bounds (max 2 model attempts for typed data questions, 3 Gemini attempts); daily cap and budget policy; prompts versioned in `prompts/`; no tool reaches approve; mutation-tested QA records.
Gaps: evals NOT RUN (harness ARC-M2-07 pending); live Gemini, Firestore, BigQuery paths NOT RUN; typed answers not wired (M2-05); Hindi red-team coverage thin; base64 and deep obfuscation rely on router, registry and approve guard; pitch cookie replayable 2 hours (accepted in design); live revision has no budget policy, durable state or approve guard.

## Security findings (potential unless stated)
| Id | Class | Finding | Status |
|---|---|---|---|
| SEC-A | Access control | Approve checkbox enforced only by UI on live; server guard off (`USTAAD_ENFORCE_APPROVE_GUARD`) | demonstrated by config, STATUS risk |
| SEC-B | IDOR | Foreign-lot access returns 403 `DEMO_SCOPE_REQUIRED`; scoping on `/api/live` and `/api/lots` pending SEC-4 | open |
| SEC-C | Abuse | Rate limit keyed on trusted `X-Forwarded-For` hop; IPv6 /64 keying pending SEC-1; two-network live check NOT RUN | open |
| SEC-D | Info exposure | `/api/status` shows runtime availability to unauthenticated callers; SEC-2 pending | open |
| SEC-E | Injection (AI) | PO, photo and document text untrusted; scoped by design; suite NOT RUN | open |
| SEC-F | Secrets | CI check scans for secrets (`scripts/quality`); `tools/prepare-release-snapshot.py` contains marker list only (STATUS). This audit did not scan history | partially verified |
| SEC-G | Dependencies | v2 bumped hono, zod, node-server, firebase-admin; this audit ran `npm ci` with `--no-audit`; no advisory scan | UNVERIFIED |
| SEC-H | XSS | New React UI escapes by default; legacy UI builds HTML with template strings (`src/operator-ui.js`, `src/ui/*.js`). Review before retiring or reusing | UNVERIFIED |
| SEC-I | Privacy | Photo upload: bucket path and retention not documented; UI copy "Do not upload photos of people" proposed (AC6.10) | open |
| SEC-J | Auditability | Approval audit exists behind `USTAAD_ENABLE_APPROVAL_AUDIT` | flag state live UNVERIFIED |

No compliance or certification claim is made. Reuse `docs/arc/delivery/reviews/M1-review.md` for reviewer-level detail.

## Preserve during migration
`src/commands/*`, `src/arc/**`, `config/*.json`, prompts, scope rules, budget and cap logic, approve guard and fingerprint handshake (UI must send `reviewConfirmed`, `revisionFingerprint`), all labels that mark simulated approval.

## Recommended additions (only where needed)
Reproducible deploy with flag settings (ARC-M8); one live run of Firestore, budget and Vertex smoke in preflight (ARC-M1-28); an advisory scan in CI; a CSP for the built `/app`.
