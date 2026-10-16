# Ustaad AI — product and testing guide

## What the product does

Ustaad supports corrugated-production preparation: read a purchase order with Gemini, validate the item against the catalog, confirm production conditions, estimate five defect risks, search constrained machine settings, explain the result, and create an operator-approved PDF JobSheet. Historical evidence, approved-photo diagnosis and Impact provide supporting context.

The system combines Gemini extraction/explanation with deterministic validation, BigQuery ML prediction, constrained SQL optimization and human confirmation. It is a tool-orchestrated decision-support workflow, not an autonomous machine controller.

## Current availability

- The latest source includes the premium analytics UI and an honest empty Impact layout. No sample KPI values appear in the ordinary local preview.
- The last verified private Cloud Run candidate is documented in [release provenance](RELEASE_PROVENANCE.md). It predates the latest local empty-state improvement; the repository and deployed image must not be conflated.
- **Model acceptance (D4).** The source is accepted for the supervised prototype by owner decision D4-2026-10-16-OM, with crack shown as low confidence in monsoon. The currently deployed candidate predates this and still refuses the live prediction → optimized JobSheet → approval/card journey. Unsupported actions must refuse rather than return fixture recommendations.
- The repository and Cloud Run service are private. Reviewers need separately authorized access; cloning does not grant GCP permissions.

## Run the interface locally

```sh
npm ci
npm run preview:local
```

Open http://localhost:4173. Visit **New Lot**, **Defect Check** and **Impact**. Cloud-dependent controls are unavailable until the corresponding genuine services are available in an authorized environment. Impact still shows clearly labeled KPI/chart placeholders so the user can understand what will load. No provider call happens simply because the page is opened.

For a separately labeled offline contingency, `npm run demo:local` exercises deterministic mock adapters and process-memory records. Its outputs are **not** live Gemini/BQML/GCS evidence. See [local setup](LOCAL_DEVELOPMENT.md) before attempting cloud access.

## Approved purchase-order inputs

Use these exact checked-in inputs; arbitrary customer uploads are restricted. The input-directory names are legacy identifiers. For data interpretation, use the source provenance and each result's simulation/prediction labels rather than inferring provenance from a folder name.

| Input | File | Test purpose |
|---|---|---|
| PO1 | [Single-item PDF](../public/samples/PO1_ClientA_single_B1047.pdf) | Primary extraction/review scenario |
| PO2 | [Multi-line PDF](../public/samples/PO2_ClientA_multiline.pdf) | Multiple-line review |
| PO3 | [Electronics/fitment PDF](../public/samples/PO3_ClientP_electronics_with_fitment.pdf) | Catalog/specification handling |
| PO4 | [Ambiguous-set PDF](../public/samples/PO4_ClientQ_ambiguous_set.pdf) | Clarification/refusal behavior |
| PO5 | [Scanned order JPEG](../public/samples/PO5_ClientB_scanned.jpg) | Image-based input |

The [expected extraction records](../test/fixtures/synthetic_POs/expected_results.json) describe source fields and ambiguity expectations. They are comparison fixtures, not responses that the genuine cloud runtime should substitute for Gemini. The same exact input bytes are retained under the regression-test fixture paths.

PO1 SHA256: `d789722039e0d9f29d2106655416aae0447159d23df56c7dc215ee875c8fb44a`.

## Suggested review sequence

1. **New Lot:** inspect the supported input/review controls. Genuine extraction requires the configured cloud deployment, approved input and authorization. Review the extracted line; do not invent missing catalog fields.
2. **Conditions:** choose the shift, review simulated/manual readings and planned settings, then confirm explicitly. These are not physical sensor telemetry.
3. **Model gate:** on a revision without the D4 owner decision, verify the clear refusal. Do not treat the offline backup as proof that the models passed acceptance.
4. **Defect Check → Historical Evidence:** in an authorized cloud environment, select WARP and RH 86 and request history. The prior verified response showed 685 primary-defect cases, while the 401/397 comparison groups used a different all-defect humidity cohort. Historical associations are not causal recommendations.
5. **Photo Diagnosis:** load the ten approved choices; selecting an image must not call Gemini. Classification is a deliberate metered action. The API does not provide a browser image preview. Prior classification matched 7/10 expected labels; that is not calibrated factory QA accuracy.
6. **Impact:** explicitly load the existing BigQuery analysis. Estimates are held-out simulation results, not measured factory savings or annualized ROI. View the original values and source context alongside the charts.
7. After genuine model evidence is accepted, follow the [full cloud acceptance procedure](FINAL_PO_TO_CARD_ACCEPTANCE.md) to verify prediction, optimization, durable JobSheet/audit and independent PDF retrieval.

## What not to infer

- A locally running UI is not a verified Google Cloud integration.
- A draft or generated PDF is not proof of durable approved cloud state.
- Approach B establishes a signed session capability, not verified human identity.
- A prediction/held-out estimate is not an observed manufacturing outcome.
- Recorded feedback is not completed-lot learning; that feature is outside the approved V1 scope without a verified outcome contract.

Do not deliberately exhaust quota or rerun all ten paid classifications for inspection. Preserve the shared 100-attempt IST Gemini counter, TEST/fixture restrictions and existing query caps.
