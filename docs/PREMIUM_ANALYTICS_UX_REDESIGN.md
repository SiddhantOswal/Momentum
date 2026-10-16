# Premium analytics UX redesign — private candidate review

Date: 16 October 2026. This is a controlled presentation change, not a model acceptance or full application end-to-end release.

## Result and scope

**Recommendation: keep the private candidate for owner review. Do not merge, promote traffic or publish it as part of this change.** Defect Intelligence and Production Impact now communicate their main comparisons through stronger numerical hierarchy and composed visual panels. Photo Diagnosis separates selection from analysis, but cannot provide an actual image preview under the immutable existing API. That part of the requested image-first experience remains unsupported; no substitute image was invented.

The affected live checks found no application regression. This does **not** prove every model-dependent workflow: D4 remains blocked, so fresh prediction, optimization, JobSheet creation/approval and PDF production were deliberately not exercised. Unchanged source is evidence of a preserved implementation, not proof of a freshly successful cloud operation.

## Protected baseline and exact candidate

| Identity | Value |
|---|---|
| Protected V1 baseline | `936b86893330057c32958aaae1e1733b40a8bb97` |
| Verified UX parent | `7509266ed70202e4eaf83aab56734a5502ccb3be` |
| New branch | `feature/ustaad-premium-analytics-ui` |
| Baseline private revision | `prepagent-ux-defect-v2` |
| Baseline image | `sha256:3acba6b9e7ea77b589b5c2e62848b225a31d9fed6338a7f397f33fd10fbd0248` |
| Final private revision | `prepagent-premium-analytics-v2` |
| Final tag | `premium-analytics-v1` |
| Final Cloud Build | `c324d109-f0a3-41a4-9942-2d62fd4781f8` |
| Image digest | `sha256:e1103dec7a9271c475d9e2d03c891da2f3a0d66480a134b3ccee54a29dc478ae` |
| Runtime manifest SHA256 | `ec42893201317037120a231b73f651b0eafbd1b751e6737ebe8b3eadbf9d124d` |
| Archive SHA256 | `b5fa78e2a3091c202c698d47ce388adb809830a404e0a7fa938fc12df2f08936` |
| Dependency lock SHA256 | `77cd7f6966e93a89d3140520b62cb7ffcd1b2431f8ad40ad045b1864b2c8d65d` |

Private candidate: <https://premium-analytics-v1---prepagent-26mwt2n7ba-el.a.run.app>.
Baseline: <https://ux-defect-v1---prepagent-26mwt2n7ba-el.a.run.app>.
Both require an authorized Cloud Run invoker. The candidate URL is not a public judging release.

The image was built from an immutable manifest of an uncommitted snapshot over the verified UX parent. Its OCI revision label identifies that parent; the complete source identity is the manifest above, not the parent commit alone. `SOURCE.json` records the pre-build snapshot; `BUILD_RESULT.json` and `DEPLOYMENT.json` record subsequent execution. Any later feature commit is mapped separately in `FEATURE_COMMIT.json`.

## Changed files

- `src/operator-ui.js`: compose the three screens, retain every original static element ID, and add accessible disclosures and result containers.
- `src/operator-ui.css`: scoped bronze/graphite analytics surfaces, typography, responsive composition, focus and reduced-motion treatment.
- `src/ui/components.js`: actual-data SVG comparison plots, historical interpretation, photo result presentation and Impact comparison; preserve original detailed data and Chart.js datasets.
- `src/ui/workflow.js`: connect presentation renderers to existing validated responses, clear new containers with existing empty/error handling and invalidate stale photo presentation on selection/inventory refresh.
- This document: provenance, mappings, evidence and limitations.

No new dependency, external font, CDN script, analytics tracker, API route, backend response, SQL, model, optimizer, approval, session, storage, counter or IAM code was changed. See `SOURCE_INTEGRITY.json` for the file-by-file comparison against the verified parent. No new query is invoked merely to populate a visualization.

## Reference inspection and design choices

All four actual reference images were inspected, including the owner's attached manufacturing dashboard. Evidence copies: `reference-1.jpg`, `reference-2.png`, `reference-3-owner.png`, `reference-4.png`. The third website was blocked by Cloudflare; the attachment resolved that limitation.

1. Industrial IoT: adopted stronger KPI grouping and deliberate analytics composition.
2. Sentinex: adopted selection/analysis separation; did not invent live cameras, image previews, boxes, heatmaps or confidence.
3. Attached manufacturing cockpit: adopted prominent business KPIs and a primary chart beside operational detail; did not copy its OEE, production, downtime, productivity or unsupported time-series metrics.
4. Dark analytics: adopted restrained surface depth, stronger numerical typography and consistent spacing without copying branding or content.

### Before versus after

| Screen | Previous composition | New composition |
|---|---|---|
| Historical evidence | Three separate bordered KPIs, ordinary bars, repeated blocks | Unified metric hero; two-group zero-based dot comparison; separate-unit condition plots; compact categorical chips; short deterministic observations; full detail/notes disclosures |
| Photo Diagnosis | Narrow selector/button/text result | Two-column inspection workspace; explicit server-side image boundary; selected-asset context; prominent returned label and structured genuine metadata |
| Impact | Metrics followed by charts/tables | Net-value hero; baseline/agent cost comparison and rate pair; monthly chart beside anonymized operational detail; secondary seasonal/methodology detail retained |
| Mobile | Tall stacked cards and always-expanded secondary detail | Dominant case/savings KPI with two compact supporting cells; primary comparison first; secondary notes/conditions/seasonal detail progressively disclosed |

## Existing contracts — unchanged

| Method / route | Request | Response used | Authority / usage |
|---|---|---|---|
| POST `/evidence/seen-before` | `{defect, ambientRhPct}` | case count, average selected rate, aggregate scrap cost, good/bad groups, notes | Existing Approach B session; bounded BigQuery read; no Gemini |
| GET `/evidence/approved-photos` | none | ten `{id,label}` choices | Existing session; server-owned inventory; no classification |
| POST `/evidence/classify-photo` | `{photoId}` | `ok,source,photoId,label,model,classifiedAt` | Existing session and exact allowlist; one metered attempt per provider attempt |
| GET `/impact/summary` | none | `kpis,monthly,seasonal,topItems,counterfactual` plus source/cache metadata | Existing approved read-only policy; existing four BigQuery query families and cache |
| GET `/health` | existing status request | configured integrations, auth mode, D4 status, runtime availability | Existing protected policy; no data/model mutation |
| POST `/api/auth/demo-session` | existing bootstrap | signed temporary session cookie | Approach B, not verified human Google identity |
| POST `/jobs/:jobId/feedback` | existing persisted-job-associated feedback | existing adapter response | No change; no fabricated completed-lot outcome |

Errors continue through the existing request/validation gates. New visual content is cleared alongside previous content; null/nonfinite data is not silently replaced by a fabricated zero. The deployed existing validators rejected malformed history and incomplete Impact payloads in narrow client checks; these were not represented as GCP outage tests.

## Visualization data mapping

| Visualization | Existing endpoint and fields | Transform / units | Null handling | Meaning / disclosure |
|---|---|---|---|---|
| Historical case KPI | seen-before `caseCount` | integer count | existing contract and unavailable state | selected primary-defect lots in RH window |
| Historical average KPI | `avgRateWhenMain` | percent display | unavailable, not invented zero | average selected rate in primary-defect cases, not a prediction |
| Historical cost KPI | `costWhenMain` | existing INR/currency formatting | unavailable | sum of total lot scrap cost for those cases, not selected-defect-attributed savings |
| Defect-rate dot comparison | `goodRuns.avgRatePct`, `badRuns.avgRatePct`, `.lots` | zero-based common percent scale, direct values/counts | absent group stays unavailable | descriptive rate-selected cohorts, not a treatment effect |
| Five condition dot pairs | group `sfSpeedMpm`, `rollTempC`, `gumViscositySec`, `dryingHours`, `printSpeedSpm` | **separate zero-based scale per measure**; m/min, °C, seconds, hours, sheets/min | unavailable pair/field shown without a fake point | associations, not causal recommendations |
| Categorical chips | group `gumApplication`, `pastingPressure` | original strings, no numeric encoding | unavailable label | historical category comparison |
| Original comparison table | `.lots`, `.avgRatePct` and all seven settings | original nine rows and both groups | original unavailable behavior | complete textual equivalent retained |
| Deterministic observations | returned rates, drying values, categories | direct descriptive text, no AI call | omitted if comparison absent | no inferred causality or advice |
| Photo diagnosis | actual classification `label,photoId,model,classifiedAt` | label name plus verbatim structured metadata | not supplied / idle / error states | no invented confidence or causal explanation |
| Impact hero | `kpis.netSavingMonth,kgSavedMonth,lotsScored,lotsChanged` | INR, kg, integer counts | existing strict response validation | one held-out month, estimated not measured |
| Cost comparison | `kpis.scrapCostBefore,scrapCostAfter` | zero-based INR columns | no plot from invalid values | raw baseline versus agent-settings cost **before** allowance |
| Scrap-rate pair | `kpis.scrapPctBefore,scrapPctAfter` | direct percentage values, no unsupported probability | no invented value | held-out averages, not measured improvement |
| Post-allowance note | `counterfactual.scrapCost` and `kpis.netSavingMonth` | direct INR amounts kept separate | unavailable if absent | allowance-inclusive cost differs from raw agent cost |
| Monthly chart / table | all `monthly` rows plus existing counterfactual point | original 24 months, single held-out point; existing dataset unchanged | original gaps remain gaps | no invented optimized historical series |
| Seasonal chart / table | all `seasonal` rows and five rate fields | original four seasons, five datasets | original validation | historical averages, no causal claim |
| Highest-cost items | all `topItems` fields | all ten anonymized rows | original validation | supplied source window, no customer item codes |

No optional third historical distribution was added: the response does not supply the necessary distribution/denominators.

## Verified cohort semantics: 685 versus 401 / 397

`sql/seen_before.sql` is unchanged. Its humidity band includes **all lots** within ±10 relative-humidity percentage points. For WARP at RH 86:

- **685 cases**: only lots whose primary defect is WARP. The 2.3% is the average selected rate in these cases. ₹2,06,262 is their aggregate **total lot** scrap cost.
- **401 / 397 observations**: lower/upper selected-rate groups from **all** humidity-band lots, including other primary defects. Approximate quartile boundaries and ties determine membership; these are not components of 685. The original SQL's first matching good-group branch resolves overlapping cutoffs.
- There is no plant or date filter in this query; the interface does not invent PLANT-01-specific historical scope.
- Operator notes use a separate feedback join with selected primary defect but no RH filter. They are broader historical observations; the original three returned notes are preserved exactly. Their order is not guaranteed by the query.

The UI keeps a visible different-cohorts warning, an accessible definitions disclosure, direct group observation counts and the noncausality caveat. No percentages use 685 as the denominator for the two comparison groups.

## Real response checks

| Value | Baseline response | Final candidate response / rendering |
|---|---:|---:|
| Cases | 685 | 685 |
| Primary-defect average | 2.3% | 2.3% |
| Aggregate historical cost | ₹2,06,262 | ₹2,06,262 |
| Good / bad observations | 401 / 397 | 401 / 397 |
| Good / bad rates | 1.2% / 3% | 1.2% / 3% |
| Speed | 41.9 / 42.6 m/min | identical |
| Roll temperature | 167.2 / 168.1 °C | identical |
| Viscosity | 39.5 / 39.8 s | identical |
| Drying | 8.3 / 5.2 h | identical |
| Print speed | 53.7 / 54.5 sheets/min | identical |
| Gum / pressure | MED/HIGH; MED/MED | identical |
| Net estimated saving | ₹7,320 | ₹7,320 |
| Estimated scrap reduction | 138 kg | 138 kg |
| Scored / changed lots | 219 / 207 | 219 / 207 |
| Baseline / raw agent cost | ₹78,774 / ₹71,434 | identical |
| Post-allowance cost | ₹71,454 | ₹71,454, separately disclosed |
| Baseline / agent scrap average | 7.06% / 6.39% | identical |

The ₹7,340 raw cost difference is **not** presented as net saving. The response reports ₹7,320 after allowance. Monthly historical aggregation may round differently (September row ₹78,776); original values remain accessible rather than silently forced to agree with another aggregate.

## Photo boundary and result verification

The ten-photo inventory, selector, selection invalidation, enabled classification control, strict server rejection of an unapproved photo and original result paragraph were checked live. Selecting or loading photos made no provider call. The current backend has **no safe browser-readable image-byte route**. Adding one would violate this task's immutable backend/API boundary. The UI explicitly states that browser preview is unavailable; it does not expose private GCS paths or signed URLs.

`PHOTO_RESULT_PRESENTATION.json` and `after-photo-recorded-result-*.png` verify the **deployed presentation renderer** with an unmodified previously recorded genuine Gemini response: CRACK, gemini-3.5-flash, original timestamp 2026-10-15T23:14:07.310Z. A prominent replay notice is present in each screenshot. No network response was mocked, and no new classification was requested. This is **not a fresh deployed Gemini invocation**. Historical 7/10 label matches are unchanged and do not establish calibrated factory QA accuracy.

## Actual live verification and repair history

No local unit, acceptance or mock-browser suite was rerun. Three changed JavaScript files passed `node --check`; `git diff --check` passed.

| Evidence | Result | Scope |
|---|---|---|
| `BEFORE_CAPTURE.json` | 16/16 | Actual private baseline browser/data/screens |
| `AFTER_CAPTURE.json` | 16/16 | Actual final candidate browser/data/screens at 1440/1920/768/390 |
| `FUNCTIONAL_LIVE.json` | 65/65 | Actual historical values, all rows/notes, tabs, filters, photos, feedback controls, Impact rows/datasets, currency, New Lot controls, D4/session/status |
| `MOBILE_LIVE.json` | 15/15 | Actual fresh mobile render, 360/390/430 widths, no overflow, disclosures reachable |
| `HTTP_LIVE.json` | 8/8 | Actual signed-session/security negative cases; no model-dependent write |
| `FINAL_STATIC_AND_BROWSER_AUDIT.json` | recorded separately | Actual served asset hashes, keyboard focus, responsive overflow and palette contrast |
| `PHOTO_RESULT_PRESENTATION.json` | presentation only | Clearly labeled prior genuine response replay, zero new classification requests |
| `DOWNSTREAM_READBACK.json` | real metadata read-back | Firestore counter and actual BigQuery job metadata |

Initial build `94ed0ee7-5034-45f6-afc7-f2a664f745d6` deployed `prepagent-premium-analytics-v1`. Screenshot review identified three design weaknesses: the history comparison started too low, the photo placeholder consumed too much space, and Impact secondary metadata competed with value. A bounded refinement shortened the history/filter/KPI spacing, reduced the photo placeholder and placed full Impact source/cache metadata in a disclosure while retaining the visible simulation/estimate caveat. Final build/revision are recorded above.

Two harness timing/modality failures are retained, not erased:

1. `V1_FUNCTIONAL_LIVE_INITIAL.json`: checked a New Lot checkbox immediately after opening an animated disclosure. Failure screenshot showed the controls existed. The harness now explicitly waits for visibility; final Cloud Run check passed. No application logic was changed to force the result.
2. `FINAL_AUDIT_INITIAL.json`: programmatic focus after a mouse action did not activate browser `:focus-visible`. The corrected test uses keyboard ArrowRight tab navigation; final focus result is separately recorded. No focus styling was weakened.

The screenshot originally named `after-impact-mobile-default-390.png` was actually captured at the harness's final 430px viewport. It has been renamed **`after-impact-mobile-default-430.png`**. Genuine 390px Impact screenshots remain `after-impact-390.png` and `after-impact-full-390.png`. No dimensions are inferred from an incorrect filename.

## Accessibility and responsive review

- Existing tabs retain role/tablist/tabpanel, roving selection, Home/End/arrow keys and focus treatment. Table disclosure was opened with the keyboard.
- Native details controls retain keyboard operation. Mobile conditions, notes, seasonal data and all item/metric rows were opened live.
- Charts have direct group labels, numerical values, units and full detailed tables. Bronze/slate distinction is not the sole carrier of information.
- New palette contrast is calculated against its graphite panel; all five tested text/button pairs exceed 4.5:1. This is a bounded check, **not** full WCAG certification.
- Reduced-motion preferences suppress new SVG transitions; the fresh-mobile harness used reduced motion.
- No page overflow at 360/390/430; table scrolling remains scoped to its region. Desktop/tablet screenshots were inspected for overlaps and balance.
- At 390px, the first historical comparison begins at 1,171 CSS pixels; at 360px, 1,255; at 430px, 1,171. Each is within two 844px viewports, though not immediately above the fold. The global truthful provenance banner remains visible and contributes to page height.
- Supporting metadata is sometimes 12–13px to preserve density; important values/body/controls are larger. Screen-reader and 200% browser-zoom audits were not exhaustively performed and are not claimed PASS.

## Screenshot review: five simulated professional perspectives

These are internal design reviews of actual screenshots, not independent human judges or official hackathon scores.

| Perspective | Specific observation / dissent | Resolution / disposition |
|---|---|---|
| Enterprise product designer | Old cards and bars gave everything equal emphasis; first candidate still delayed charts | Unified summary, asymmetric primary evidence, less filter whitespace; final desktop has a clearer reading sequence. Keep |
| Data visualization specialist | Small condition differences must not be exaggerated or merged across units; raw/net cost distinction critical | Zero-based individual axes, exact paired labels, categories as text, allowance note. Keep; historical group selection caveat remains essential |
| Plant supervisor | Need the original settings/notes and accessible next action, not an attractive replacement | Nine-row table, exact notes and New Lot link retained; mobile expands details. Keep; current model recommendations remain unavailable |
| Accessibility specialist | Color alone, faint captions and programmatic-focus checks are insufficient | Direct values, readable new palette, keyboard navigation and disclosures verified. Keep within bounded checks; no certification claim |
| Skeptical UX judge | A placeholder is not an image-first inspection tool, and a recorded result is not a new Gemini test | Agreed. Photo preview objective is only partially met under immutable API. Result replay labeled; no fabricated confidence. Keep visual upgrade with explicit limitation |

## Acceptance matrix

PASS refers to the stated bounded check, not global release readiness.

| Area | Visual quality | Functional preservation | Genuine data | Live Cloud Run verification |
|---|---|---|---|---|
| Defect Intelligence | PASS | PASS affected flows | PASS | PASS |
| KPI cards | PASS | PASS | PASS exact response mapping | PASS |
| Defect-rate comparison | PASS | PASS | PASS correct separate cohort | PASS |
| Condition comparison | PASS | PASS all original values | PASS | PASS |
| Detailed evidence / notes | PASS | PASS full table and exact notes | PASS | PASS |
| Photo Diagnosis | PARTIAL: refined workspace, image preview unavailable | PASS inventory/select/guards; fresh paid success UNVERIFIED this pass | PASS prior result only, explicitly replayed | PASS controls/guards; fresh provider result UNVERIFIED |
| Impact | PASS | PASS all metrics/rows/datasets | PASS held-out estimates | PASS |
| Mobile | PASS inspected | PASS tested disclosures/navigation | PASS same payload | PASS tested widths |
| Navigation | PASS | PASS New Lot/Defect/Impact/session/status/currency | same application | PASS |
| Authorization | unchanged | PASS bounded negative cases | not a verified human identity claim | PASS tested requests |
| Model gate | unchanged | PASS fail-closed | no accepted model output invented | PASS blocker response; model workflow BLOCKED D4 |

No known critical regression was discovered in the exercised presentation paths. “100% functionality preserved” is an implementation requirement; it must not be misread as a fresh successful run of every D4-blocked action. The full action inventory below states that distinction explicitly.

## Cloud operations, controls and cost

- Two Cloud Builds, each with a 900-second timeout, using the existing registry/build identity. Actual build elapsed time: about 62 seconds each, approximately 125 seconds total. Image/source storage and build/Cloud Run charges exist; the incremental invoice is not yet available. No unsupported exact INR cost is asserted.
- Two private candidate revisions, with final tag moved from premium v1 to v2. Baseline UX/V1 revisions/images remain intact.
- Service/default traffic remains **100% `prepagent-00005-s5x`**; tagged revisions carry no default traffic.
- Private IAM unchanged. No allUsers/allAuthenticatedUsers grants. Runtime identity remains `prepagent-run@prepagent-hack.iam.gserviceaccount.com`.
- Service/revision maximum remains 2, minimum 0, concurrency 1, timeout 120 seconds, 1 CPU / 1Gi memory. Existing Approach B secret/version reused, not exposed.
- Model acceptance remains blocked; approved-input-only restrictions, mock-route isolation and counter configuration unchanged.
- **Zero new Gemini attempts.** Final independent Firestore read-back: 2/100 for the current IST day. Counter was not reset; no new provider calls were needed for rendering.
- 18 runtime-service-account BigQuery jobs were observed during the acceptance interval; all DONE, cache hits and **0 bytes billed** in metadata. This is time/SQL attribution, not per-request isolation from another concurrent same-SA client. Exact IDs below. No new optimizer/evaluation/training job was run.
- No JobSheet, feedback, generated-card or manufacturing data write was initiated by this visual acceptance. GCS writes were build-source/image artifacts only.
- Existing ₹5,000 alert and ₹27,000 planned ceiling were not modified. Budget alert delivery/current invoice were not retested; alerts are not hard spend limits.

### Observed BigQuery job metadata

| Job ID | Classified read | Bytes billed | Cache hit |
|---|---|---:|---|
| job_CMaEXGng7JFYU7mjj-buRnTODhyq | historical/other bounded read | 0 | True |
| job_OvbObb-icZcoo2MdEE-P-5pLzZaR | impact | 0 | True |
| job_PbHtN_wXfPGbaS9FK0Xs85TT35B9 | historical/other bounded read | 0 | True |
| job_dZAEGD2OmZwPL5rwPTUe6HjMuzX6 | historical/other bounded read | 0 | True |
| job_Xd1-r7uOeSU-WDRHj2hddE8s5M2I | impact | 0 | True |
| job_jIxqWWyxj3C5pGK7VkoO2mEKuu1J | historical/other bounded read | 0 | True |
| job_MyYZXiPCJjPvl66VzybbraRXASVh | historical/other bounded read | 0 | True |
| job_IJmiwKeMfoRBm2r3DwxuvuzgQrlE | historical/other bounded read | 0 | True |
| job_5fhOOQpsK8WFx1xlU3FWJdSakbPi | impact | 0 | True |
| job_szA245ggueAA3OAcM3yichQbFW8u | historical/other bounded read | 0 | True |
| job_5-bw7glQpbyhKhEswqXZfV5Cq8Lu | impact | 0 | True |
| job_VgXYbTNUQLRMe33mfz9esjhM55Mc | historical/other bounded read | 0 | True |
| job_8EzbFLtnsmTfwB-xzS0SRxuAvIw4 | historical/other bounded read | 0 | True |
| job_S0XoYq3xIjeZU4Ru6ORbWRuhbOOX | historical/other bounded read | 0 | True |
| job_QKgUfsVYBUt5raJ-weIWqXWdpq9Q | historical/other bounded read | 0 | True |
| job_SVZWvUQKGI8DRbpg0X0XrCHqGHDE | impact | 0 | True |
| job_6AUKSXAMzyA14CbVqpKTflsDavn9 | impact | 0 | True |
| job_GsBz2i2Sx4UjnXKvUMYKTRt1tSw- | historical/other bounded read | 0 | True |

## Safe rollback and review

The baseline tag/revision was not replaced. To discard the premium entry point without changing default traffic or IAM:

```sh
gcloud run services update-traffic prepagent --project=prepagent-hack --region=asia-south1 --remove-tags=premium-analytics-v1
```

This removes only the new tag; do not run it unless withdrawing this candidate is desired. Default traffic remains on the original revision. To inspect the baseline:

```sh
gcloud run revisions describe prepagent-ux-defect-v2 --project=prepagent-hack --region=asia-south1
gcloud run services describe prepagent --project=prepagent-hack --region=asia-south1 --format=json
gcloud run services get-iam-policy prepagent --project=prepagent-hack --region=asia-south1 --format=json
```

A focused merge of the eventual feature commit can be reviewed separately. No merge or push is performed here. Do not switch branches with unrelated dirty screenshot/evidence changes without preserving them. Full model-enabled acceptance still follows `docs/FINAL_PO_TO_CARD_ACCEPTANCE.md` after genuine D4 validation; this UX upgrade does not reopen that architecture.

## Before / after screenshot index

All links below are actual remote Cloud Run renders. Full-page images may be scaled down by the viewer; open at original dimensions for typography review.

| View | Before | After |
|---|---|---|
| History 1440 | [Before](evidence/premium-analytics-20261016/before-history-1440.png) | [After](evidence/premium-analytics-20261016/after-history-1440.png) |
| History 1920 | [Before](evidence/premium-analytics-20261016/before-history-1920.png) | [After](evidence/premium-analytics-20261016/after-history-1920.png) |
| History tablet 768 | [Before](evidence/premium-analytics-20261016/before-history-768.png) | [After](evidence/premium-analytics-20261016/after-history-768.png) |
| History phone 390 | [Before](evidence/premium-analytics-20261016/before-history-full-390.png) | [After, fresh mobile defaults](evidence/premium-analytics-20261016/after-history-mobile-default-390.png) |
| Photo initial 1440 | [Before](evidence/premium-analytics-20261016/before-photo-initial-1440.png) | [After](evidence/premium-analytics-20261016/after-photo-initial-1440.png) |
| Photo initial 1920 | [Before](evidence/premium-analytics-20261016/before-photo-initial-1920.png) | [After](evidence/premium-analytics-20261016/after-photo-initial-1920.png) |
| Photo initial tablet | [Before](evidence/premium-analytics-20261016/before-photo-initial-768.png) | [After](evidence/premium-analytics-20261016/after-photo-initial-768.png) |
| Photo initial phone | [Before](evidence/premium-analytics-20261016/before-photo-initial-full-390.png) | [After](evidence/premium-analytics-20261016/after-photo-initial-full-390.png) |
| Photo recorded response | Prior genuine payload, no new call | [1440](evidence/premium-analytics-20261016/after-photo-recorded-result-1440.png), [1920](evidence/premium-analytics-20261016/after-photo-recorded-result-1920.png), [768](evidence/premium-analytics-20261016/after-photo-recorded-result-768.png), [390](evidence/premium-analytics-20261016/after-photo-recorded-result-390.png) |
| Impact overview 1440 | [Before](evidence/premium-analytics-20261016/before-impact-1440.png) | [After](evidence/premium-analytics-20261016/after-impact-1440.png) |
| Impact overview 1920 | [Before](evidence/premium-analytics-20261016/before-impact-1920.png) | [After](evidence/premium-analytics-20261016/after-impact-1920.png) |
| Impact overview tablet | [Before](evidence/premium-analytics-20261016/before-impact-768.png) | [After](evidence/premium-analytics-20261016/after-impact-768.png) |
| Impact phone | [Before](evidence/premium-analytics-20261016/before-impact-full-390.png) | [After](evidence/premium-analytics-20261016/after-impact-full-390.png) |
| Impact charts | [Before](evidence/premium-analytics-20261016/before-impact-charts-1440.png) | [After](evidence/premium-analytics-20261016/after-impact-charts-1440.png) |

Matching chart-section screenshots also exist at 1920/768/390. Source images and raw safe acceptance JSON remain untracked evidence, not part of the runtime image or automatically published.

## Feature preservation traceability

| Original feature → old location | New location | Unchanged route/service | Actual verification | Result |
|---|---|---|---|---|
| Defect / RH / search → historical form | same form, horizontal surface | POST seen-before / BigQuery | real query and changed-filter invalidation | PASS |
| Three KPIs → separate cards | unified hero | same response | exact baseline/final/visible values | PASS |
| Good/bad rates → bars | zero-based dots and labels | same group fields | exact values and counts | PASS |
| Seven settings / lots / rates → table | detailed evidence + chart/chips | same response | nine rows, all eighteen cells | PASS |
| Operator notes → observations block | accessible notes disclosure | same response | exact three note strings | PASS |
| Technical response / caveats | retained, prominent noncausality note | same result binding | actual response/disclosures | PASS affected paths |
| Photo inventory / picker / classify | left inspection column | same photo endpoints / Gemini | ten options, selection, button and invalid-input guard | PASS controls; new paid success UNVERIFIED |
| Photo result / provenance | right analysis column | same returned fields | labeled replay of genuine recorded result | presentation PASS; no fresh call |
| Feedback / observed rates | same Defect page disclosure | existing feedback adapter | form reachable, no unlinked write allowed | PASS controls; real submit not repeated |
| Impact load / all eight metrics | hero plus evaluation disclosure | GET impact summary / BigQuery | same response and all original metrics | PASS |
| Monthly chart / all rows | primary history panel | same monthly dataset | 24 rows plus counterfactual point exact | PASS |
| Seasonal chart / all rows | seasonal disclosure | same five datasets | all four rows/five datasets exact | PASS |
| Item breakdown | operational panel / disclosure | same anonymized topItems | all ten rows, generic labels | PASS |
| Currency preference | global header | same client formatting | INR/USD preference interaction | PASS |
| New Lot / upload / conditions | unchanged screens | same runtime routes | fields and confirmation controls reachable | PASS controls only |
| Risk / optimizer / explanation / what-if | unchanged analysis screen | existing accepted-model routes | D4 refusal/status preserved, no mock fallback | BLOCKED D4 positive operations |
| JobSheet / approval / PDF / feedback write | unchanged job screen | existing BQ/GCS adapters | no source change; no hidden gate bypass | BLOCKED D4 integrated operations |
| Session / backend status | unchanged header dialogs | same Approach B/status | actual dialogs and auth negatives | PASS bounded cases |

### Complete original rendered-control inventory

The baseline inventory contains 127 controls/links/canvases, including controls hidden until their workflow state permits them. All 164 original static server IDs remain present. This is an explicit inventory, not an assertion that 127 independent positive workflows ran. D4-gated and Firebase-separate controls retain their original conditions. Entries marked UNVERIFIED were not activated merely for a visual regression exercise.

| # | Original control / location | New location | API / service | Actual verification / disposition |
|---:|---|---|---|---|
| 1 | `Skip to main content` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 2 | `ustaadaiPRODUCTION INTELLIGENCE` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 3 | `New Lot` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 4 | `Defect Check` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 5 | `Impact` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 6 | `display-currency` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 7 | `open-status` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 8 | `open-session` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 9 | `Download approved PO1` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 10 | `1Order inputOrder & floor context` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 11 | `2Production analysisRisk & recommendations` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 12 | `3Job card & approvalReview, approve & print` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 13 | `order-pdf` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 14 | `review-order` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 15 | `Technical response` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 16 | `confirm-order-line` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 17 | `extraction-order-id` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 18 | `extraction-paper-type` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 19 | `extraction-paper-supplier` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 20 | `Item specificationCatalog details and any missing order fields+` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 21 | `analysis-orderId` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 22 | `analysis-itemCode` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 23 | `analysis-customerId` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 24 | `analysis-boxStyle` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 25 | `analysis-lengthMm` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 26 | `analysis-widthMm` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 27 | `analysis-heightMm` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 28 | `analysis-ply` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 29 | `analysis-fluteProfile` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 30 | `analysis-topLinerGsm` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 31 | `analysis-fluteGsm` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 32 | `analysis-innerLinerGsm` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 33 | `analysis-linerBf` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 34 | `analysis-paperType` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 35 | `analysis-paperSupplier` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 36 | `analysis-inkColors` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 37 | `analysis-inkCoveragePct` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 38 | `analysis-quantity` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 39 | `Production setupConditions and 7 planned settings · confirmation required+` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 40 | `Load conditions` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 41 | `analysis-runDate` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 42 | `analysis-shift` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 43 | `analysis-ambientRhPct` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 44 | `analysis-ambientTempC` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 45 | `analysis-paperMoisturePct` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 46 | `Technical response` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 47 | `conditions-supervisor-confirmed` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 48 | `Machine settings 7 levers · within approved ranges` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 49 | `analysis-sfSpeedMpm` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 50 | `analysis-rollTempC` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 51 | `analysis-gumApplication` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 52 | `analysis-gumViscositySec` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 53 | `analysis-pastingPressure` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 54 | `analysis-dryingHours` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 55 | `analysis-printSpeedSpm` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 56 | `machine-settings-confirmed` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 57 | `prepare-job` | Same New Lot screen | Existing extraction/catalog/conditions/coordinator | PASS field/confirmation availability; paid extraction not repeated, model-enabled plan BLOCKED D4 |
| 58 | `Edit lot inputs` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 59 | `Connect to an existing run` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 60 | `trace-run-id` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 61 | `Connect to trace` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 62 | `request-risk` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 63 | `Technical response` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 64 | `request-optimization` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 65 | `Technical response` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 66 | `Evidence & explanationSimilar runs and model attribution+` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 67 | `load-similar-runs` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 68 | `Technical response` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 69 | `request-risk-explanation` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 70 | `Technical response` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 71 | `Explore a what-ifChange one lever. Re-score the scenario without changing your plan.` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 72 | `what-if-lever` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 73 | `what-if-value` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 74 | `what-if-rescore` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 75 | `Review job card →` | Same analysis screen | Existing risk/optimizer/history/explanation/trace | BLOCKED D4 positive model operations; unchanged wiring; other individual actions UNVERIFIED |
| 76 | `Local PDF utility Render a supplied JobSheet, separate from production approval` | Same job-card screen | Existing JobSheet / BigQuery / GCS | BLOCKED D4 integrated workflow; utility actions not rerun |
| 77 | `job-sheet-json` | Same job-card screen | Existing JobSheet / BigQuery / GCS | BLOCKED D4 integrated workflow; utility actions not rerun |
| 78 | `Validate and render PDF` | Same job-card screen | Existing JobSheet / BigQuery / GCS | BLOCKED D4 integrated workflow; utility actions not rerun |
| 79 | `pdf-link` | Same job-card screen | Existing JobSheet / BigQuery / GCS | BLOCKED D4 integrated workflow; utility actions not rerun |
| 80 | `shared-job-id` | Same job-card screen | Existing JobSheet / BigQuery / GCS | BLOCKED D4 integrated workflow; utility actions not rerun |
| 81 | `Load stored job` | Same job-card screen | Existing JobSheet / BigQuery / GCS | BLOCKED D4 integrated workflow; utility actions not rerun |
| 82 | `Approve job` | Same job-card screen | Existing JobSheet / BigQuery / GCS | BLOCKED D4 integrated workflow; utility actions not rerun |
| 83 | `Fetch approved card` | Same job-card screen | Existing JobSheet / BigQuery / GCS | BLOCKED D4 integrated workflow; utility actions not rerun |
| 84 | `stored-card-link` | Same job-card screen | Existing JobSheet / BigQuery / GCS | BLOCKED D4 integrated workflow; utility actions not rerun |
| 85 | `di-tab-history` | Defect tabs / historical panel / photo selection column | seen-before / approved-photos / classify-photo | PASS historical/tab/inventory controls; fresh paid classification UNVERIFIED |
| 86 | `di-tab-photo` | Defect tabs / historical panel / photo selection column | seen-before / approved-photos / classify-photo | PASS historical/tab/inventory controls; fresh paid classification UNVERIFIED |
| 87 | `evidence-defect` | Defect tabs / historical panel / photo selection column | seen-before / approved-photos / classify-photo | PASS historical/tab/inventory controls; fresh paid classification UNVERIFIED |
| 88 | `evidence-humidity` | Defect tabs / historical panel / photo selection column | seen-before / approved-photos / classify-photo | PASS historical/tab/inventory controls; fresh paid classification UNVERIFIED |
| 89 | `find-seen-before` | Defect tabs / historical panel / photo selection column | seen-before / approved-photos / classify-photo | PASS historical/tab/inventory controls; fresh paid classification UNVERIFIED |
| 90 | `Technical response` | Defect tabs / historical panel / photo selection column | seen-before / approved-photos / classify-photo | PASS historical/tab/inventory controls; fresh paid classification UNVERIFIED |
| 91 | `New Lot` | Defect tabs / historical panel / photo selection column | seen-before / approved-photos / classify-photo | PASS historical/tab/inventory controls; fresh paid classification UNVERIFIED |
| 92 | `Approved photo classification` | Defect tabs / historical panel / photo selection column | seen-before / approved-photos / classify-photo | PASS historical/tab/inventory controls; fresh paid classification UNVERIFIED |
| 93 | `load-approved-photos` | Defect tabs / historical panel / photo selection column | seen-before / approved-photos / classify-photo | PASS historical/tab/inventory controls; fresh paid classification UNVERIFIED |
| 94 | `approved-photo-id` | Defect tabs / historical panel / photo selection column | seen-before / approved-photos / classify-photo | PASS historical/tab/inventory controls; fresh paid classification UNVERIFIED |
| 95 | `classify-approved-photo` | Defect tabs / historical panel / photo selection column | seen-before / approved-photos / classify-photo | PASS historical/tab/inventory controls; fresh paid classification UNVERIFIED |
| 96 | `Record observed outcomes Feedback for a persisted job` | Same feedback disclosure | Existing feedback adapter | PASS form availability; submission UNVERIFIED (no persisted job) |
| 97 | `feedback-warp` | Same feedback disclosure | Existing feedback adapter | PASS form availability; submission UNVERIFIED (no persisted job) |
| 98 | `feedback-delam` | Same feedback disclosure | Existing feedback adapter | PASS form availability; submission UNVERIFIED (no persisted job) |
| 99 | `feedback-strength` | Same feedback disclosure | Existing feedback adapter | PASS form availability; submission UNVERIFIED (no persisted job) |
| 100 | `feedback-print` | Same feedback disclosure | Existing feedback adapter | PASS form availability; submission UNVERIFIED (no persisted job) |
| 101 | `feedback-crack` | Same feedback disclosure | Existing feedback adapter | PASS form availability; submission UNVERIFIED (no persisted job) |
| 102 | `feedback-lot-id` | Same feedback disclosure | Existing feedback adapter | PASS form availability; submission UNVERIFIED (no persisted job) |
| 103 | `feedback-photo-uri` | Same feedback disclosure | Existing feedback adapter | PASS form availability; submission UNVERIFIED (no persisted job) |
| 104 | `feedback-note` | Same feedback disclosure | Existing feedback adapter | PASS form availability; submission UNVERIFIED (no persisted job) |
| 105 | `Submit observed feedback` | Same feedback disclosure | Existing feedback adapter | PASS form availability; submission UNVERIFIED (no persisted job) |
| 106 | `load-impact` | Impact hero / primary chart / seasonal disclosure | GET impact/summary / BigQuery | PASS actual values/charts/disclosures |
| 107 | `Technical response` | Impact hero / primary chart / seasonal disclosure | GET impact/summary / BigQuery | PASS actual values/charts/disclosures |
| 108 | `Evaluation detailsBaseline costs and scrap rates+` | Impact hero / primary chart / seasonal disclosure | GET impact/summary / BigQuery | PASS actual values/charts/disclosures |
| 109 | `impact-monthly-chart` | Impact hero / primary chart / seasonal disclosure | GET impact/summary / BigQuery | PASS actual values/charts/disclosures |
| 110 | `View monthly values` | Impact hero / primary chart / seasonal disclosure | GET impact/summary / BigQuery | PASS actual values/charts/disclosures |
| 111 | `impact-seasonal-chart` | Impact hero / primary chart / seasonal disclosure | GET impact/summary / BigQuery | PASS actual values/charts/disclosures |
| 112 | `View seasonal values` | Impact hero / primary chart / seasonal disclosure | GET impact/summary / BigQuery | PASS actual values/charts/disclosures |
| 113 | `×` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 114 | `Refresh status` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 115 | `Status details` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 116 | `Production preparation workflow` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 117 | `×` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 118 | `supervisor-sign-in` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 119 | `supervisor-sign-out` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 120 | `Display preferences & currency calculator` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 121 | `language-preference` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 122 | `currency-amount` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 123 | `source-currency` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 124 | `Convert for display` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 125 | `×` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 126 | `confirm-approval` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
| 127 | `Keep as draft` | Same shell/dialog | Existing navigation/session/status/currency | PASS tested navigation/status/session/currency; remaining individual dialog actions UNVERIFIED |
