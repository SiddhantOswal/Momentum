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

- `OrderProfileSchema` defines the complete extraction result, including
  blueprint enums and ranges. `OrderExtractionInputSchema` permits fields to
  be omitted while Gemini extracts them. `missingFields` is generated from
  the same canonical field list; invalid supplied values are validation issues,
  not missing fields.
- `RunConditionsSchema` and `LeversSchema` follow the documented run date,
  shift, condition ranges, lever ranges, and `LOW`/`MED`/`HIGH` values.
- `RiskResultSchema` covers the five defect rates, total scrap, cost, currency,
  and primary defect. `OptimizationResultSchema` covers baseline, best, up to
  three changes, and savings. `JobSheetSchema` combines those documented
  values and the `DRAFT`/`APPROVED`/`RUN`/`CLOSED` lifecycle.
- Feedback and photo-classification validators use the fields represented in
  the playbook's `feedback` BigQuery table. Plant configuration, locale, and
  currency contracts follow its `plants` and multilingual sections.
- Validation errors have one structured contract: `ok: false` and
  `error: { code, message, issues }`, where each issue carries its field, path,
  Zod code, and readable message.

`src/bigquery-mapper.js` is the centralized camelCase API to snake_case
BigQuery boundary. It validates both sides against row schemas copied from the
playbook's `lots`, `sensor_readings`, `feedback`, and `plants` table definitions.
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
