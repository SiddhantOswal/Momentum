# Change: deploy `v3` to production (`momentum-ai.cloud.run`)

- Date: 2026-11-26
- Status: RUN on 2026-11-27 (IST), approved by Om in the session ("Approve and deploy") after the M6 security re-check (`reviews/M6-review.md`).
- Asked by: Om, 2026-11-26 ("deploy to https://momentum-ai.cloud.run/"), then "Fix G-2 to G-5, then deploy".
- Service: Cloud Run `momentum`, `asia-south1`, project `prepagent-hack`, runtime account `prepagent-run@prepagent-hack.iam.gserviceaccount.com`.

## Live state read on 2026-11-26 (read-only)
- `momentum-00023-yaz` serves 100% at `https://momentum-ai.cloud.run` (origin `https://momentum-ai.cloud.run`, max 4 instances, old Gemini cap `GEMINI_DAILY_ATTEMPT_CAP=300`, no budget-v2, no Arc).
- The service template is the `arc-test` revision's settings (`USTAAD_PUBLIC_ORIGIN` set to the removed tag URL), as the 26 Nov arc-test record warned. This deploy sets every value explicitly.
- Seven older tags still have public URLs: `arc-limits` (on `momentum-00023-yaz`), `demo`, `domain`, `polish`, `r2fix`, `v2be`, `welcome` (M6 finding SEC-15).
- Secrets: `ustaad-hackathon-session-signing`, `momentum-weather-api-key`. No `arc-pitch-reserve-code` yet.

## Plan
1. Build from `v3` at the merged commit: `npm --prefix web run build`, `python3 tools/prepare-release-snapshot.py`, one `gcloud builds submit` with `cloudbuild.yaml` (container smoke test, `npm audit --omit=dev`).
2. Pitch reserve secret (ARC-M6-R4): `openssl rand -hex 16 | tr -d '\n' | gcloud secrets create arc-pitch-reserve-code --data-file=- --replication-policy=automatic` (128 bits, never printed); grant `roles/secretmanager.secretAccessor` on that one secret to `prepagent-run@`. Om reads it on the pitch laptop straight to the clipboard, never on a screen that may be projected: `gcloud secrets versions access latest --secret=arc-pitch-reserve-code --project=prepagent-hack | pbcopy`.
3. Test revision, no traffic: `gcloud run deploy momentum --image=<image@digest> --no-traffic --tag=rc --revision-suffix=v3-rc1 --concurrency=20 --max-instances=4` with every flag below and `USTAAD_PUBLIC_ORIGIN` set to the `rc` tag URL, so the whole flow can be tried there. Run `tools/release-preflight.mjs` against the tag URL, then one PO1 run through Arc to the Approve card, without approving.
4. Production revision, no traffic: the same image and flags with `USTAAD_PUBLIC_ORIGIN=https://momentum-ai.cloud.run`, `--revision-suffix=v3-prod1`, no tag. Read back its env and limits.
5. Before traffic: read back `USTAAD_PUBLIC_ORIGIN` on both revisions (the server refuses sessions on Cloud Run without it, ARC-M6-R3b), the limits JSON and every flag. Then `gcloud run services update-traffic momentum --to-revisions=momentum-v3-prod1=100`. Then on `https://momentum-ai.cloud.run`: `/` redirects to `/app/`, `/health` 200, `/api/status` without a session shows no budget fields, one PO1 run to the Approve card, and two clients on different networks (laptop and a phone on mobile data) get separate rate-limit counts (`RATE_LIMIT_TRUSTED_HOPS` stays at the code default).
6. Remove the `rc` tag after the check, and remove the seven old tags (`arc-limits`, `demo`, `domain`, `polish`, `r2fix`, `v2be`, `welcome`) with `--remove-tags`. Required by the security re-check: they serve Gemini outside budget-v2, and new session cookies still verify on their older code. The revisions stay; only their public URLs go.

## Flags and limits
All M1 and Arc flags as on `arc-test` (`USTAAD_ENABLE_ARC`, `_ARC_METRICS`, `_FIRESTORE_IDEMPOTENCY`, `_DURABLE_PO_REVIEWS`, `_DURABLE_TRACES`, `_LOT_REVISIONS`, `USTAAD_ENFORCE_APPROVE_GUARD`, `USTAAD_ENFORCE_MODEL_VERSIONS`, `USTAAD_GEMINI_BUDGET_POLICY=budget-v2`), plus `ARC_PITCH_RESERVE_CODE` from the new secret.

Proposed `GEMINI_BUDGET_LIMITS` (ADR-0004 numbers, founder decision F2 for the rupee cap; Om confirms before the run):

| Limit | Value | Why |
|---|---|---|
| `dayLimit` | 300 | Same day total as the live revision today |
| `ipDayLimit` | 120 | Below the day limit, so one address cannot use the whole day (G-5) |
| `sessionDayLimit` | 40 | ADR-0004 |
| `minuteLimit` / `sessionMinuteLimit` | 20 / 6 | ADR-0004 |
| `dayCostCapInr` | 600 | F2 live pool default. The cap has no reserved share, so public spend must leave room for the pitch: the budget store recorded 24 live attempts on 25 and 26 Nov costing ₹27.33, at most ₹1.76 an attempt (26 Nov). At that rate the 220 public calls cost about ₹387, leaving about ₹213 for the 80 reserved calls (about ₹141). Small sample; re-read after the `rc` check |
| `demoSessionMint.perIpPerHour` | 30 | As on `arc-test` |
| `pitchClaim.attemptsPerIpPerHour` | 5 | ADR-0004 |
| `lotPlans.perSessionPerDay` | 10 | As on `arc-test` |
| `reserve` | 80 units, 2026-12-04T00:00+08:00 to 2026-12-05T00:00+08:00, `sessionDayLimit` 120 | Pitch day in Singapore, the whole day until the slot time is known (F2) |

## Cost
One Cloud Build (a few rupees); two revisions at min instances 0; Gemini under the ₹600 daily cap; one secret with a few reads a day (under ₹1 a day, NOT VERIFIED); BigQuery under the existing per-query byte caps and the plan limit.

## Risks
- Production moves from the old cap (300 attempts) to budget-v2. The new counters start at zero; the old counter is not read.
- Sessions minted before ARC-M6-R3 have no audience and are refused once; users reload and get a new session. The new session has a new ID, so a browser loses access to drafts, lots and Arc history from its old session, and a pitch claim has to be made again after the deploy.
- `USTAAD_PUBLIC_ORIGIN` must be set on both revisions: without it the audience falls back to the request host (ARC-M6-R3 notes).
- `tools/release-preflight.mjs` now opens a session before reading `/api/status` (ARC-M6-R2); it has not yet run against a live revision, so step 3 is its first live run.
- The new revision writes to the production Firestore, BigQuery `job_sheets` and Cloud Storage, as `arc-test` did.
- The old tags, if kept, are public revisions with older settings that share the session signing secret. After R3 their cookies do not work on the new revision, but they still serve their own Gemini calls under the old cap.

## Rollback
`gcloud run services update-traffic momentum --to-revisions=momentum-00023-yaz=100`. One command, no data change. `momentum-00023-yaz` is kept until the release gate passes. The secret can be disabled with `gcloud secrets versions disable`.

## Result
Run 2026-11-27 (IST; 26 Nov UTC). The test tag is `v3rc`, not `rc`: Cloud Run tags need at least 3 characters.
- Build: `v3` at `488f8e3`, snapshot manifest `b986a707…`, Cloud Build `9583058b` SUCCESS (smoke test and audit), image `prepagent@sha256:71826c14…`.
- Secret `arc-pitch-reserve-code` version 1 created from `openssl rand -hex 16` (128 bits, never printed); `prepagent-run@` has `secretAccessor` on it.
- Test revision `momentum-v3-rc1` (tag `v3rc`, origin the tag URL): `/` redirects to `/app/`; `tools/release-preflight.mjs` passed (health, D4 acceptance, model versions verified for all five, budget-v2 enforced, `sessionCallsLeft` 40, every integration on except `getInsights`, which has no live adapter). PO1 through Arc: Gemini read the order, line confirmed, conditions 62% RH, 24.5 °C, moisture 7.3, 27 Nov, DAY, settings 48, 162, HIGH, 32, MED, 5, 60; plan roll 170 °C, gum MEDIUM, viscosity 45 s, modeled scrap 56.4 to 49.2 kg, 7.2 kg and ₹384 lower, the same as `arc-test` on 26 Nov. Approve card reached, not approved.
- Production revision `momentum-v3-prod1` (origin `https://momentum-ai.cloud.run`, max 4 instances, concurrency 20, 42 env settings, limits as in the table) read back before traffic; Ready, no startup warnings.
- Traffic: `momentum-v3-prod1` 100%. On `https://momentum-ai.cloud.run`: `/` 302 to `/app/`, `/app/` 200, `/health` 200, `/api/status` without a session returns the 8 public fields only. PO1 through Arc: stored DRAFT for PKBX0041, 1,300 boxes, 56.4 to 49.2 kg, the same settings; Approve card reached with no demo wording; not approved.
- Defect seen on the first live plan: the panel stayed on "Planning the lot" although the turn completed on the server (turn record `complete`, lot at `draft_review`, job stored); Cloud Run logged "Truncated response body" for the plan request. A reload showed the Compare card. Follow-up ticket: the panel should read the turn record when the stream ends early.
- No `client_key_unknown` warning in the revision's logs, so client addresses resolve. The two-network check (laptop and a phone on mobile data) is NOT RUN: only one network was available to the orchestrator.
- Tags removed: `v3rc`, `arc-limits`, `demo`, `domain`, `polish`, `r2fix`, `v2be`, `welcome`; each answers 404. The revisions are kept. `momentum-00023-yaz` is kept for rollback.
- Gemini cost today (budget store): 4 attempts, ₹9.14, ₹2.29 an attempt (two PO1 runs). At that rate 220 public calls cost about ₹503, which leaves about ₹97 under the ₹600 cap for the 80 reserved calls that need about ₹183. The pitch reserve is therefore NOT fully protected by the rupee cap; the security re-check's condition 1 is not met at this rate. It matters only inside the reserve window (4 December, SGT); a limits-only revision before then fixes it (founder decision pending: a higher rupee cap, or a lower public day limit).
