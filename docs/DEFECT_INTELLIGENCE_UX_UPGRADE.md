# Defect Intelligence UX upgrade — controlled freeze exception

## Preservation and scope

Owner authorized a reviewed baseline commit, isolated branch, frontend-only upgrade, bounded Cloud Build and private zero-default-traffic candidate. No public push/merge/release is authorized by this change.

Baseline commit: `936b86893330057c32958aaae1e1733b40a8bb97` on `main`. Branch: `feature/defect-intelligence-ux`. The baseline includes the latest approved-data wording source manifest `365e632b166294dbb95d8103b6e7183e473bdc12985a9edba4d7260cb155613f`, not merely the older HEAD. Latest verified baseline revision is `prepagent-approved-365e632b`; historical `prepagent-v1f-9edd78db` is also preserved. No claim that the baseline commit equals the older frozen manifest9edd78db.

An explicit248file staging allowlist produced142changed files in the baseline commit. Runtime/build source, textual tests/tools/ops and approved root Markdown documents were reviewed. Generated evidence, screenshots, raw datasets/model artifacts, environment/credentials and unrelated changes were excluded. The only secret-pattern match was a literal private-key detection string in the existing rejection guard, not a key. See `docs/evidence/defect-intelligence-ux-20261016/BASELINE_STAGING_REVIEW.json`. No push occurred.

Feature changes are limited to `src/operator-ui.js`, `src/operator-ui.css`, `src/ui/components.js` and this document, plus narrowly updated existing browser expectations for the new tab/table/chart presentation. Backend/API/SQL, models, authorization, counter, storage, standards and Impact service are unchanged. Feature commit and final cloud identifiers are recorded in `docs/evidence/defect-intelligence-ux-20261016/FEATURE_COMMIT.json` and `DEPLOYMENT.json` after live acceptance.

## Design and information hierarchy

- Keep the existing header, navigation, brand, session controls and English/INR behavior.
- Defect Intelligence title; Historical Evidence default and one-click Photo Diagnosis; WAI-ARIA tab roles, arrow/Home/End navigation and visible focus.
- Compact search controls, three actual-response KPIs, cohort explanation, two comparison panels, concise deterministic observations, original detailed table, exact operator notes and visible limitations.
- Scoped graphite/bronze styling; neutral second series, explicit numeric text, zero-based scales, no causal arrows or animations/dependencies.
- No third distribution chart: the endpoint supplies no humidity-bucket population or distribution. No fabricated series or extra aggregation added.
- Photo inventory, picker, classification control/results and all feedback fields stay intact. No image preview is introduced because the safe endpoint does not expose image bytes/URLs; branding remains undisplayed.

## Verified metric definitions: 685 versus401+397

Source: unchanged `sql/seen_before.sql`, mapped by `src/google-cloud/risk-evidence-service.js`. Actual baseline WARP/RH86 response is in BEFORE_BROWSER.json.

1. `band`: direct rows from `prepagent.lots` with absolute relative-humidity difference≤10percentage points, no plant or date filter. `r` is the selected defect's recorded rate. There is no join in this CTE.
2. `cases`: only band rows whose `primary_defect` equals the selected defect. COUNT(*)→caseCount685; AVG(r)→avgRateWhenMain2.3%; SUM(scrap_cost)→costWhenMain₹206262. Cost is total scrap cost for those lots, not selected-defect-attributed cost or savings. Counts are source lot-row observations; unique lot-ID deduplication is not asserted.
3. `q/grouped`: approximate quartile cutoffs over **all** band rows, regardless of primary defect. GOOD includes r≤Q1; BAD includes qualifying r≥Q3 which did not meet GOOD. CASE gives GOOD precedence if cutoffs coincide. Boundary ties mean counts need not equal exact25%cohorts. Labels are descriptive, not independently validated quality classifications.
4. `levers`: aggregates each group's rows: GOOD401, BAD397. These are not parts of685; they may include cases of other primary defects. No percentage or inferred denominator is calculated from685or798.
5. `notes`: separate feedback-to-lots join, primary-defect filter, DISTINCT notes LIMIT3, **no humidity filter**, no order or date/plant filter. Notes can come from outside the selected humidity cohort. Preserve their exact text and disclose this scope; no attribution to the current order or causal validation.

The685cases and798comparison observations are different cohorts, not an arithmetic defect. The UI explains this visibly. SQL is unchanged, including approximate thresholds and note semantics. No extra reconciliation query is needed.

## Visualization/data mapping

Visualization | Endpoint | Response fields | Transformation | Units | Null handling | Disclosure
---|---|---|---|---|---|---
Matching cases | POST/evidence/seen-before | caseCount | en-IN integer formatting | Lot-row observations | Existing strict response validation; no invented zero | Selected defect primary;±10RHpoints
Historical average | Same | avgRateWhenMain | Format actual mean | Percent | Existing strict validation | Mean selected-defect rate among matching primary cases;not prediction
Historical cost | Same | costWhenMain | Format INR,whole rupees | INR | Existing strict validation | Aggregate lot scrap cost;not savings
Defect-rate comparison | Same | goodRuns/badRuns.avgRatePct,lots | Two labeled bars sharing0to max(1,returned rates) | Percent;lot observations | Null group explicitly unavailable;no bar | Approximate lower/upper quartiles across all humidity-band lots;notcausal
Condition comparisons | Same | sfSpeedMpm,rollTempC,gumViscositySec,dryingHours,printSpeedSpm | Paired values and per-measure zero-based bars;explicit endpoints | m/min,°C,s,h,sheets/min | Null group unavailable;no inferred value | Separate axes;historical averages;not adjustments
Categorical chips | Same | gumApplication,pastingPressure | Exact category strings | LOW/MED/HIGH | Unavailable if no group | Most frequent returned categories;not recommendations
Observations | Same | Actual rate/drying/category group fields | Deterministic string construction only | Actual units | No comparative summary without both groups | Selected-by-rate groups;difference not treatment effect
Detailed table | Same | lots,avgRatePct,all7lever fields | Original valueFor formatting | Original units | Original Unavailable behavior | All9original rows,keyboard disclosure
Operator observations | Same | notes[] | textContent exact text | Text | Explicit no-notes state | Broader primary-defect history;not humidity-filtered

All DOM text uses textContent. No returned note becomes HTML. Chart widths use only validated finite numeric response fields. No raw data is hidden in canvas-only representations; numbers remain accessible as text. Existing strict isSeenBefore contract is retained.

## Existing route contracts — unchanged

Route | Request | Response used | Authorization/error/usage
---|---|---|---
POST/evidence/seen-before | {defect,ambientRhPct} | ok,source,defect,caseCount,avgRateWhenMain,costWhenMain,goodRuns,badRuns,notes | SignedApproachBsession,Origin;400invalid/503unavailable;oneboundedBigQueryquery,noGemini
GET/evidence/approved-photos | None | photos[]opaqueIDs | Existing signed session;exact10inventory;no provider call
POST/evidence/classify-photo | {photoId} | label,model,provenance,usage | Existing Origin/session/allowlist/sharedcounter;oneGeminiattempt per valid classification;not executed for polish
POST/jobs/:id/feedback | Existing supported observed-rate/notes fields | Existing saved feedback result | OwnedTESTpersistedjob;no invented outcome or learning lot;unchanged
GET/impact/summary | None | Existing strict dashboard response | Existing bounded4queries/cache/privacy;unchanged
POST/orders/extract;POST/jobs;POST/jobs/:id/approve | Existing contracts | Existing result/errors | Existing allowlist/TEST/Origin/session/D4/counter/lifecycle;unchanged

## Traceability and acceptance

Existing feature | Preserved? | Old route | New UI location | Actual cloud test | Result
---|---|---|---|---|---
History filters/search | Yes | /evidence/seen-before | HistoricalEvidence search | Before/after WARP86 | Final evidence journal
Original9rowtable | Yes | Same | Detailed evidence | Exact API/table comparison and keyboard Enter | Final evidence journal
All operator notes | Yes | Same | Operator observations | Exact string assertions | Final evidence journal
Photo inventory/picker/classify | Yes | /evidence/approved-photos;/evidence/classify-photo | PhotoDiagnosis tab | Load10,selectphoto01,buttonenabled;no paid classification repeated | Final evidence journal
Feedback | Yes | /jobs/:id/feedback | Existing disclosure below both tabs | Fieldsvisible;invalidjobwriteprotected | Final evidence journal
NewLot/header/session/currency | Yes | Existing routes | Unchanged shell | Navigation/upload/status checks | Final evidence journal
Impact | Yes | /impact/summary | Unchanged screen | ActualBigQuery/cache response | Final evidence journal
D4/auth guards | Yes | /api/status;/jobs/:id/approve | Unchanged policy | ActualnegativeHTTP/browser checks | Final evidence journal

Live before/after screenshots: evidence directory `before-1440.png`, `after-1440.png`, plus768/390versions. Initial baseline failure remains in BEFORE_BROWSER_INITIAL.json:390pxpageoverflow. Baseline control recheck continued through navigation/Impact without suppressing the failed overflow assertion in its detailed checks. A top-level PASS in the historical continuation journal does not override that false assertion. Final candidate must have no overflow.

## Release/rollback and scope limitations

Build-only existing Cloud Build path, timeout900s; no broad local suites. Static syntax checks only. Private tag `ux-defect-v1`; no default traffic/IAM change; max2,min0,same runtimeSA,secret/counter/approved upload restrictions. Source manifest/archive/build/image/revision and measured live checks live in SOURCE.json,BUILD_RESULT.json,DEPLOYMENT.json,AFTER_BROWSER.json.

Baseline remains available. If candidate fails, do not promote; withdraw only the new tag after checking intervening changes:

```sh
gcloud run services update-traffic prepagent --project=prepagent-hack --region=asia-south1 --remove-tags=ux-defect-v1
gcloud run services describe prepagent --project=prepagent-hack --region=asia-south1 --format=json
gcloud run services get-iam-policy prepagent --project=prepagent-hack --region=asia-south1 --format=json
```

Do not delete baseline/evidence or change default100%traffic. Rollback withdrawal is prepared, not performed. D4stillblocks the complete model-generated PO-to-approved-card workflow. No new model/provider acceptance or higher official score follows from visual improvement. Full cross-instance exactly-once and real-factory validation remain outside this UX change.

After verified feature commit, prepare a focused fast-forward from baseline `main` to this branch only after reviewing the exact5filefeature diff and preserving unrelated work. Do not merge or push automatically.

## Final live acceptance and recommendation

Final revision: `prepagent-ux-defect-v2` at https://ux-defect-v1---prepagent-26mwt2n7ba-el.a.run.app. Build `25b87959-7063-4bc8-a9ed-caf0db56ca31`; image `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent@sha256:3acba6b9e7ea77b589b5c2e62848b225a31d9fed6338a7f397f33fd10fbd0248`. Final manifest `ac6c20eba234945de5b5f2c3471ba994876aa4432983ec24fe44c7dc456b522c`; archive `c72848c6470c134c315d0e8f03c55af5da70f0c149097c8ee5d4b978abe07ca7`. Earlier UX revision/build and screenshots are preserved with V1_ prefixes. The second build changes only card alignment and invalidated-filter context from that first candidate.

**45/45 final live browser assertions and8/8HTTP checks passed.** Every original table cell, all10numeric condition-chart values, both defect-rate bars and all3KPI values match the actual API response. Baseline and final history responses are identical. Exact original notes remain intact. All158existing server-rendered element IDs are preserved. Keyboard tab arrows/disclosure Enter and768/390layouts passed; baseline390overflow is resolved. No uncaught browser errors. New text contrast tokens range7.14–15.90:1against the tested backgrounds, exceeding ordinary-textAA; this is not a fullWCAGcertification.

All existing photo controls remain, inventory10and selection/classify-enabled state verified; invalidphotoPOST400verifies the guarded deployed route. No paid classification was repeated and no claim is made of a new successful classification result on this revision. Feedback fields/disabled-without-job state, Impact actualBigQueryresponse and NewLot upload/navigation passed. D4 remains blocked; complete model-enabled approval/PDF is not newly accepted.

No backend/SQL/Googleadapter changed. The only pre-existing issue found was baseline mobile overflow. The first UX candidate passed22checks; visual review then removed empty card stretch and made the filter context clear immediately. Final version passed45checks; no remaining regression found in the permitted scope. No broad local suites were run. Existing focused browser test source was updated for the new tabs/details and strengthened with KPI/bar/table/cohort assertions, but was not executed as a local test.

**Recommendation: keep this private candidate and merge the focused feature after owner review.** Do not expose it publicly or claimD4/full-product acceptance. Feature commit SHA is in FEATURE_COMMIT.json outside the runtime/build; no automatic merge/push.
