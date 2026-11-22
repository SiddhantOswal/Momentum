# Change: raise Gemini daily cap and Cloud Run instances on `momentum`

- Date: 2026-11-22
- Approved by: founders (Siddhant), 2026-11-22
- Service: Cloud Run `momentum`, `asia-south1`, project `prepagent-hack`
- Not changed: `prepagent`, which stays at a 100-attempt cap and 2 instances

## Before (read from the live service on 2026-11-22)

| Setting | Value |
|---|---|
| Serving revision | `momentum-v2be-8`, 100% of traffic |
| `GEMINI_DAILY_ATTEMPT_CAP` | 100 |
| Max instances | 2 |
| Container concurrency | 20 |
| Session affinity | off |

## Change

| Setting | New value |
|---|---|
| `GEMINI_DAILY_ATTEMPT_CAP` | 300 |
| Max instances | 4 |
| Session affinity | on |

## Reason

- Arc uses more Gemini calls per lot than the manual route. Rehearsals and the pitch also share the daily cap.
- PO review state is an in-memory Map on one instance (`src/purchase-order-review.js`). Without session affinity, a request that lands on another instance loses the review. Session affinity keeps a user on one instance on a best-effort basis. It is a mitigation, not a fix; durable review state is an Arc ticket.

## Commands

```sh
# 1. New revision with no traffic, reachable on a tagged URL
gcloud run services update momentum --region asia-south1 \
  --update-env-vars GEMINI_DAILY_ATTEMPT_CAP=300 \
  --max-instances 4 --session-affinity --no-traffic --tag arc-limits

# 2. Read-only preflight against the tagged URL
BASE=<tagged url> node tools/release-preflight.mjs <out dir>

# 3. Only if the preflight passes: move traffic
gcloud run services update-traffic momentum --region asia-south1 --to-revisions <new revision>=100
```

## Cost impact

- Instances scale to zero, and CPU is throttled outside requests, so there is no idle cost. Extra instances cost money only while they serve.
- The daily Gemini spend ceiling rises from 100 to 300 attempts on `momentum`. Both services count against the same Firestore day document (`gemini_daily_usage/<IST date>`), so `prepagent` still stops at 100 on that shared count.
- The ₹5,000 budget alert is unchanged. It warns but does not cap spending.

## Rollback

```sh
gcloud run services update-traffic momentum --region asia-south1 --to-revisions momentum-v2be-8=100
```

`momentum-v2be-8` is not deleted.

## Result

Run on 2026-11-22.

1. New revision `momentum-00023-yaz` deployed with no traffic, tag `arc-limits`.
2. Preflight with `tools/release-preflight.mjs` against the tagged URL:
   - `/health` returned 200 without auth and with auth; `/api/status` returned 200 (`live-service`, `HACKATHON_DEMO`).
   - Model acceptance `D4-2026-11-20-OM` reported `accepted`, linked.
   - `geminiCap 300 true`.
   - Revision shows max scale 4 and concurrency 20; session affinity is on.
   - The integration list matches the same preflight run against `momentum-v2be-8`. `getInsights` and `durableIdempotencyConfigured` are off on both, so they predate this change.
   - Gemini counter for 2026-11-22: 0.
3. Traffic moved: `momentum-00023-yaz` at 100%. The public `/health` returned 200 afterwards.
4. `momentum-v2be-8` is kept at 0% (tag `v2be`) for rollback.

Not tested: a full PO-to-job-card run on the new revision. This change only touched environment and scaling settings, not code or image. That run belongs to the next release gate.

Open item: `getInsights` and `durableIdempotencyConfigured` are off in production. The owner and the intended state need to be checked.
