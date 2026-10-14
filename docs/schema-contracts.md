# Runtime schema contracts

The application remains JavaScript ES modules. `src/schemas.js` is the single
source of truth for Zod runtime validators. `src/types.js` re-exports those
validators and documents JSDoc type aliases derived from them, without creating
a duplicate model or adding `src/types.ts`.

JSDoc aliases support editor and TypeScript-aware tooling, but do not provide
static type-checking. A TypeScript migration is only needed if compile-time
checking or generated declarations become a project requirement; that should
be a deliberate migration with compiler configuration and incremental
conversion.

## Contract groups

The contracts follow the **Corrugated Production-Prep Agent Build Blueprint**
and **3-Day Sprint Playbook, Part 2**:

- `OrderProfileSchema` defines the selected production line's complete profile,
  including blueprint enums and ranges plus the current item-catalog
  `itemCode` key.
  Runtime dimensions accept `heightMm` 0–1500 and `lengthMm`/`widthMm`
  20–1500, per Om's current item contract (superseding the Blueprint's
  prototype 50–1200 limits). `OrderExtractionInputSchema` permits fields to
  be omitted while Gemini extracts them. `missingFields` is generated from
  the same canonical field list; invalid supplied values are validation issues,
  not missing fields. `POST /orders/extract` accepts a PDF or JPEG plus optional
  `orderId`, `paperType`, and `paperSupplier` in multipart form. These values
  are validated as operator-confirmed context and listed in
  `operatorProvidedFields`; item specifications still come from the item master.
- PO extraction asks Gemini for document-level PO number, buyer, delivery
  date, and every ordered line's item code, quantity, and 1-based source page.
  It preserves line order and incomplete lines, then resolves each code against `prepagent.items`
  using a parameterized, bounded BigQuery read. Exact matches are `MATCHED`,
  suffixed catalog matches remain `AMBIGUOUS` until the operator explicitly
  selects a candidate, and missing/unknown codes or missing quantities remain
  unresolved. The operator review displays all extracted lines and actual
  catalog candidates. Its `/orders/extract` result includes a `reviewId` and
  SHA-256 `reviewFingerprint`; `/jobs` submits those references with the
  references with the displayed one-based `confirmedLineIndex`,
  `confirmedItemCode`, `confirmedQuantity`, and
  `confirmedSourceLine=true`; the API converts the line number to the
  coordinator's zero-based index. The backend verifies the review and original
  document, then independently revalidates the exact selected line and catalog
  item before coordinator use. Corrections remain distinct from extracted
  values, and the original PO lines (including unresolved siblings) are
  retained. A stale or unavailable review fails closed; extraction is not
  silently repeated. Review state is process-local, expires after 30 minutes,
  and is capped at 100 entries, so restart or cross-instance routing can
  invalidate a review. The item table has no order ID, paper type, or paper
  supplier columns; the operator supplies the first and selects/enters loaded
  reel values. The adapter does not derive or guess these values.
- `RunConditionsSchema` and `LeversSchema` follow the documented run date,
  shift, condition ranges, lever ranges, and `LOW`/`MED`/`HIGH` values.
- `RiskResultSchema` covers the five defect rates, optional total scrap percent,
  total scrap kilograms, cost, currency, and primary defect. The optional
  percentage is populated by Om's verified `predict.sql`; the older documented
  job-sheet shape does not require it. `OptimizationResultSchema` covers baseline, best, up to
  three changes, and savings. `JobSheetSchema` combines those documented
  values and the `DRAFT`/`APPROVED`/`RUN`/`CLOSED` lifecycle.
  PO-derived JobSheets retain `order.purchaseOrderLineIndex` and
  `order.purchaseOrderSourcePage`, identifying the exact reviewed source line
  and its 1-based source page. Both are stored within the existing `order_json`
  payload and rendered on the card; non-PO JobSheets omit them. Older stored
  JobSheets remain valid.
- Feedback and photo-classification validators use the fields represented in
  the playbook's `feedback` BigQuery table. Plant configuration, locale, and
  currency contracts follow its `plants` and multilingual sections.
- Validation errors have one structured contract: `ok: false` and
  `error: { code, message, issues }`, where each issue carries its field, path,
  Zod code, and readable message.

`src/bigquery-mapper.js` is the centralized camelCase API to snake_case
BigQuery boundary. It validates both sides against row schemas copied from the
playbook's `lots`, `sensor_readings`, `feedback`, and `plants` table definitions.
Sensor readings accept an optional `source` value (`simulated` or `live`) so
the ingestion path can preserve provenance; rows without it remain valid and
are reported as unverified. The live `prepagent.sensor_readings` table has a
nullable `source STRING` column, verified on 2026-10-14; actual persistence of
publisher messages remains a separate live acceptance check. Conditions
provenance supports `fresh`, `stale`, or `unassessed`, but the current
conditions adapter has no owner-approved freshness threshold and therefore
reports `unassessed`. The PO1 coordinator fails closed unless provenance is
explicitly `live` and `fresh`; simulated, unverified, stale, unassessed, or
missing provenance cannot reach prediction or DRAFT creation.
It maps job sheets to and from the playbook's `job_sheets` row shape, validating
nested job-sheet values when reading rows. Writes require base-currency amount
and currency supplied explicitly by the caller. It does not run queries or
connect to Google Cloud.

`GET /fx?base=INR` uses Frankfurter's ECB-based feed with an in-process 24-hour
cache and a static fallback. `src/fx-fallback.json` is a dated INR snapshot
fetched from Frankfurter for 2026-10-09; API responses include the rate date and
whether they came from Frankfurter or the static fallback. Rates are not used
as model or production evidence.

## Source limitation and unresolved currency detail

The supplied documents disagree slightly on job-sheet savings currency: the
blueprint's sample `JobSheet` has `savings: { kg, inr }`, while its scaling
section and Part 2 BigQuery definition describe plant-base-currency values as
`savings_cost` plus `currency`. No job-sheet row mapper silently converts or
labels the INR amount as another currency. The row mapper requires an explicit
base-currency savings amount and ISO code in write metadata; conversion from
the sample INR field to a different plant currency remains pending clarification.

No Google Cloud calls are made by these schema or mapper modules. Tests use
explicit test fixtures only; those values are not production data, model
predictions, sensor readings, or historical evidence. The current mock order
endpoint validates caller-supplied fields; it does not read a PDF or claim
Gemini extraction is active.
