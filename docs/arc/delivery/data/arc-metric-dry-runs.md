# Arc metric dry-runs (ARC-M4-01)

Owner: data engineer. Written 2026-11-24. **Every command below is NOT RUN.** Dry-runs and live queries need founder approval, so the orchestrator runs them after it. No BigQuery job, table or view was created or changed. The queries only read `prepagent.lots` and `prepagent.items`.

Cap: every query runs through the read client with `maximumBytesBilled` of 52,428,800 (50 MiB), set in `config/arc-metrics.json` and enforced in `src/arc/metrics/query.js`. A dry-run reports `totalBytesProcessed`. Billing rounds every table read up to the 10 MiB minimum (data audit, "How this was read"), so each query below is expected to bill 10 MiB.

Run from the repository root. Each command reads the SQL file the dictionary points to, so the dry-run checks the exact text the app sends.

## Expected bytes (estimates, not measurements)

| Metric | Table read | Table size (data audit) | Estimated bytes processed | Estimated billed |
|---|---|---|---|---|
| `defect_history_at_humidity` | `lots` | 1,765,092 B | under 1.8 MB (8 of the columns) | 10 MiB minimum |
| `top_scrap_items` | `lots` | 1,765,092 B | under 1.8 MB (8 columns) | 10 MiB minimum |
| `catalog_item` | `items` | 17.5 KB | under 18 KB | 10 MiB minimum |
| `model_holdout_r2` | none | | 0 (reads `config/model-acceptance.json`) | 0 |

All three are far under the 50 MiB cap. If a dry-run reports more than 50 MiB, stop and report it; do not raise the cap.

## 1. `defect_history_at_humidity`

```
bq query --dry_run --use_legacy_sql=false --project_id=prepagent-hack --location=asia-south1 \
  --parameter=defect:STRING:WARP --parameter=ambient_rh_pct:FLOAT64:63.5 \
  "$(cat sql/arc/defect_history_at_humidity.sql)"
```

Expected shape, one row of six columns: `defect` STRING, `lots_in_band` INT64, `n_cases` INT64, `avg_rate_when_main` FLOAT64 (null when `n_cases` is 0), `cost_when_main` FLOAT64, `avg_rate_all_lots` FLOAT64. Expected schema from a dry-run: those six fields in that order. Status: NOT RUN.

Live check to run after approval: the same command without `--dry_run`, with `--maximum_bytes_billed=52428800`. Compare `n_cases` with `sql/seen_before.sql` for the same inputs, since both use the same humidity band and defect filter. Status: NOT RUN.

## 2. `top_scrap_items`

```
bq query --dry_run --use_legacy_sql=false --project_id=prepagent-hack --location=asia-south1 \
  --parameter=limit:INT64:10 \
  "$(cat sql/arc/top_scrap_items.sql)"
```

Expected shape, up to `limit` rows of six columns: `item_code` STRING, `lots` INT64, `avg_scrap_pct` FLOAT64, `scrap_cost_12m` FLOAT64, `main_defect` STRING, `currency` STRING. Live check after approval: the first ten rows should equal `sql/dash_top_items.sql`, which has the same window and ranking (the tie-break on `item_code` is the only difference). Status: NOT RUN.

## 3. `catalog_item`

```
bq query --dry_run --use_legacy_sql=false --project_id=prepagent-hack --location=asia-south1 \
  --parameter=item_code:STRING:PKBX0041 \
  "$(cat sql/arc/catalog_item.sql)"
```

Expected shape, zero or one row of 13 columns: `item_code`, `box_style`, `length_mm`, `width_mm`, `height_mm`, `ply`, `flute_profile`, `top_liner_gsm`, `flute_gsm`, `inner_liner_gsm`, `liner_bf`, `ink_colors`, `ink_coverage_pct`. `customer_id` is left out on purpose. Live check after approval: `PKBX0041` returns one row, and an unknown code returns none. Status: NOT RUN.

## 4. `model_holdout_r2`

No BigQuery query. It reads `config/model-acceptance.json` (evaluation D4-2026-11-20-OM, 219 lots). Nothing to dry-run.

## What the tests used instead

The unit tests use synthetic fixtures in `test/fixtures/arc-metrics/`, shaped like a BigQuery `jobs.query` response. Their values are made up. They prove the decoding, binding and rejection logic, not the content of the tables. A passing software test is not a check of the live data.
