# Change: Firestore TTL policies for the Arc state collections (ARC-M1-04)

- Date: 2026-11-23
- Approved by: founders, with the plan (ARC-M1-04); run by the delivery lead
- Database: Firestore `(default)`, `asia-south1`, project `prepagent-hack`, Native mode

## Before (read on 2026-11-23)

`gcloud firestore fields ttls list` returns 0 items. The existing collections are `gemini_daily_usage`, `lots` and `events` (`data/data-audit.md`). None of the 13 collection IDs below exists yet, so the policies cannot delete existing data.

## Change

One TTL policy on the field `expiresAt` for each collection group in `04-technical-design.md` section 2.0. They are created before any code writes to them (migration step 0).

`po_reviews`, `idempotency`, `traces`, `trace_events`, `budget_counters`, `budget_reservations`, `arc_sessions`, `turns`, `arc_task_runs`, `lot_heads`, `lot_revisions`, `weather_observations`, `weather_cache`

```sh
for g in po_reviews idempotency traces trace_events budget_counters budget_reservations \
         arc_sessions turns arc_task_runs lot_heads lot_revisions weather_observations weather_cache; do
  gcloud firestore fields ttls update expiresAt --collection-group="$g" --enable-ttl --database='(default)' --async
done
```

## Reason

TTL deletion can only start after a policy exists, and creating a policy can take a while. Doing it first means that durable reviews, idempotency records, traces, sessions and budget counters (ARC-M1-05 onwards) expire on their own. Code still checks the logical expiry, because TTL deletion can lag by up to about 24 hours.

## Cost impact

The policies themselves are free. Each document TTL deletes is billed as one document delete, the same as a delete from code. At the demo load (`04` section 5.7) that is a few thousand deletes a day at most, inside the free tier of 20,000 deletes a day.

## Rollback

For each group: `gcloud firestore fields ttls update expiresAt --collection-group=<group> --disable-ttl --database='(default)'`. Disabling stops future deletions; documents already deleted are not restored. That is acceptable because every one of these collections holds short-lived state.

## Verification

Read back with `gcloud firestore fields ttls list`: 13 policies on `expiresAt`, in state CREATING or ACTIVE. The result is recorded below once the change has run.
