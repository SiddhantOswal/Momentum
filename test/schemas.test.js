import assert from "node:assert/strict";
import test from "node:test";
import {
  CurrencySchema,
  DefectSchema,
  DisplayPrefsSchema,
  FeedbackInputSchema,
  JobSheetSchema,
  LeversSchema,
  OrderExtractionApiResponseSchema,
  OrderExtractionInputSchema,
  OrderExtractionResultSchema,
  OrderProfileSchema,
  OptimizationResultSchema,
  PhotoClassificationSchema,
  PlantConfigSchema,
  PURCHASE_ORDER_FIELDS,
  RiskPredictionRequestSchema,
  RiskResultSchema,
  RunConditionsSchema,
  ServiceUnavailableSchema,
  StoredJobSheetSchema,
  ValidationFailureSchema,
} from "../src/schemas.js";
import {
  mapFeedbackToBigQuery,
  mapJobSheetFromBigQuery,
  mapJobSheetToBigQuery,
  mapLotFromBigQuery,
  mapLotToBigQuery,
  mapPlantFromBigQuery,
  mapPlantToBigQuery,
  mapRiskPredictionParameters,
  mapSensorReadingFromBigQuery,
  mapSensorReadingToBigQuery,
} from "../src/bigquery-mapper.js";
import {
  explainRisk,
  extractOrder,
  findSimilarRuns,
  generateJobSheet,
  getConditions,
  optimizeLevers,
  predictRisk,
} from "../src/mock-agents.js";
import { extractOrderFromMock } from "../src/order-extraction.js";

const order = {
  orderId: "PO-TEST-1",
  itemCode: "SKU-TEST-1",
  customerId: "CUSTOMER-TEST-1",
  boxStyle: "RSC",
  lengthMm: 520,
  widthMm: 360,
  heightMm: 260,
  ply: 3,
  fluteProfile: "B",
  topLinerGsm: 125,
  fluteGsm: 115,
  innerLinerGsm: 125,
  linerBf: 18,
  paperType: "VIRGIN",
  paperSupplier: "SUP-A",
  inkColors: 4,
  inkCoveragePct: 52,
  quantity: 1200,
};

const conditions = {
  runDate: "2026-10-10",
  shift: "DAY",
  ambientRhPct: 54,
  ambientTempC: 29,
  paperMoisturePct: 9,
};

const levers = {
  sfSpeedMpm: 42,
  rollTempC: 168,
  gumApplication: "MED",
  gumViscositySec: 40,
  pastingPressure: "MED",
  dryingHours: 6,
  printSpeedSpm: 55,
};

const risk = {
  ratesPct: {
    WARP: 1.2,
    DELAM: 0.8,
    STRENGTH: 0.5,
    PRINT: 0.6,
    CRACK: 0.4,
  },
  totalScrapKg: 1.75,
  scrapCost: 78.75,
  currency: "INR",
  primaryDefect: "WARP",
};

const jobSheet = {
  jobId: "JC-TEST-1",
  plantId: "PLANT-TEST",
  order,
  conditions,
  baseline: { levers, risk },
  recommended: {
    levers: { ...levers, sfSpeedMpm: 45 },
    risk: { ...risk, totalScrapKg: 1.25, scrapCost: 56.25 },
  },
  changes: [{
    lever: "sfSpeedMpm",
    from: 42,
    to: 45,
    reason: "Test fixture only.",
  }],
  savings: { kg: 0.5, inr: 22.5 },
  explanation: "Test fixture only.",
  status: "DRAFT",
};

test("purchase-order contracts enforce the blueprint and report missing fields", () => {
  assert.equal(OrderProfileSchema.safeParse(order).success, true);
  assert.equal(OrderExtractionInputSchema.safeParse({ orderId: "PO-TEST-2" }).success, true);
  assert.equal(OrderProfileSchema.safeParse({ ...order, ply: 4 }).success, false);
  assert.equal(OrderProfileSchema.safeParse({ ...order, paperType: "Kraft" }).success, false);
  assert.equal(OrderProfileSchema.safeParse({ ...order, lengthMm: 19 }).success, false);
  assert.equal(OrderProfileSchema.safeParse({ ...order, quantity: 0 }).success, false);
  assert.equal(OrderProfileSchema.safeParse({ ...order, extra: true }).success, false);

  const partial = extractOrderFromMock({ orderId: "PO-TEST-2", boxStyle: "RSC" });
  assert.equal(partial.needsClarification, true);
  assert.ok(partial.missingFields.includes("quantity"));

  const apiResponse = extractOrder({ orderId: "PO-TEST-2", boxStyle: "RSC" });
  assert.equal(OrderExtractionApiResponseSchema.safeParse(apiResponse).success, true);
  assert.equal(apiResponse.source, "mock-demo");
  assert.equal(apiResponse.isRealModelPrediction, false);

  const invalid = extractOrderFromMock({ ...order, ply: 4 });
  assert.equal(ValidationFailureSchema.safeParse(invalid).success, true);
  assert.equal(invalid.error.issues[0].field, "ply");
});

test("synthetic purchase-order input validates through extraction and reports every missing field", () => {
  assert.equal(OrderProfileSchema.safeParse({}).success, false);

  const complete = extractOrderFromMock(order);
  assert.equal(OrderExtractionResultSchema.safeParse(complete).success, true);
  assert.deepEqual(complete, {
    orderProfile: order,
    missingFields: [],
    needsClarification: false,
  });

  const empty = extractOrderFromMock({});
  assert.equal(OrderExtractionResultSchema.safeParse(empty).success, true);
  assert.deepEqual(empty.missingFields, PURCHASE_ORDER_FIELDS);
  assert.equal(empty.needsClarification, true);

  const partial = extractOrderFromMock({ orderId: "PO-TEST-PARTIAL", boxStyle: "RSC" });
  assert.deepEqual(partial.missingFields, PURCHASE_ORDER_FIELDS.filter(
    (field) => !["orderId", "boxStyle"].includes(field)
  ));
  assert.equal(partial.needsClarification, true);
});

test("purchase-order schema accepts documented boundaries and rejects malformed values", () => {
  const boundaryOrder = {
    ...order,
    lengthMm: 20,
    widthMm: 1500,
    heightMm: 0,
    ply: 7,
    topLinerGsm: 80,
    fluteGsm: 400,
    innerLinerGsm: 80,
    linerBf: 12,
    inkColors: 4,
    inkCoveragePct: 100,
    quantity: 1,
  };
  assert.equal(OrderProfileSchema.safeParse(boundaryOrder).success, true);
  assert.equal(OrderProfileSchema.safeParse({ ...order, lengthMm: 1392 }).success, true);

  for (const invalidOrder of [
    { ...order, lengthMm: 19 },
    { ...order, widthMm: 1501 },
    { ...order, heightMm: -1 },
    { ...order, heightMm: 1501 },
    { ...order, topLinerGsm: 79 },
    { ...order, fluteGsm: 401 },
    { ...order, linerBf: 41 },
    { ...order, inkColors: 5 },
    { ...order, inkCoveragePct: 100.1 },
    { ...order, quantity: 0 },
    { ...order, ply: 4 },
    { ...order, boxStyle: "UNKNOWN" },
    { ...order, quantity: "1200" },
    { ...order, unexpected: true },
  ]) {
    assert.equal(OrderProfileSchema.safeParse(invalidOrder).success, false);
  }

  const invalidExtraction = extractOrderFromMock({
    ...order,
    lengthMm: 19,
    boxStyle: "UNKNOWN",
    unexpected: true,
  });
  assert.equal(ValidationFailureSchema.safeParse(invalidExtraction).success, true);
  assert.ok(invalidExtraction.error.issues.some((issue) => issue.field === "lengthMm"));
  assert.ok(invalidExtraction.error.issues.some((issue) => issue.field === "boxStyle"));
  assert.ok(invalidExtraction.error.issues.some((issue) => issue.message.includes("unexpected")));
});

test("conditions and lever schemas use the documented ranges and enum values", () => {
  assert.equal(RunConditionsSchema.safeParse(conditions).success, true);
  assert.equal(RunConditionsSchema.safeParse({ ...conditions, shift: "EVENING" }).success, false);
  assert.equal(RunConditionsSchema.safeParse({ ...conditions, paperMoisturePct: 21 }).success, false);
  assert.equal(LeversSchema.safeParse(levers).success, true);
  assert.equal(LeversSchema.safeParse({ ...levers, gumApplication: "MEDIUM" }).success, false);
  assert.equal(LeversSchema.safeParse({ ...levers, sfSpeedMpm: 61 }).success, false);
});

test("risk, optimization, and job-sheet schemas match the blueprint contracts", () => {
  assert.equal(RiskResultSchema.safeParse(risk).success, true);
  assert.equal(RiskResultSchema.safeParse({
    ...risk,
    ratesPct: { ...risk.ratesPct, CRACK: 26 },
  }).success, false);

  const optimization = {
    baseline: { levers, risk },
    best: jobSheet.recommended,
    changes: jobSheet.changes,
    savings: jobSheet.savings,
  };
  assert.equal(OptimizationResultSchema.safeParse(optimization).success, true);
  assert.equal(OptimizationResultSchema.safeParse({
    ...optimization,
    changes: [...jobSheet.changes, ...jobSheet.changes, ...jobSheet.changes, ...jobSheet.changes],
  }).success, false);
  assert.equal(JobSheetSchema.safeParse(jobSheet).success, true);
  assert.equal(JobSheetSchema.safeParse({ ...jobSheet, status: "approved" }).success, false);
  assert.equal(JobSheetSchema.safeParse({
    ...jobSheet,
    order: { ...order, quantity: 0 },
  }).success, false);
});

test("feedback and photo classification are explicit, BigQuery-compatible contracts", () => {
  assert.equal(FeedbackInputSchema.safeParse({
    jobId: "JC-TEST-1",
    lotId: "LOT-TEST-1",
    rateWarpPct: 1.3,
    override: false,
    operatorNote: "Test fixture only.",
    noteLang: "en",
  }).success, true);
  assert.equal(FeedbackInputSchema.safeParse({ jobId: "JC-TEST-1" }).success, false);
  assert.equal(FeedbackInputSchema.safeParse({
    jobId: "JC-TEST-1",
    operatorNote: "A note without actual outcome or image.",
  }).success, false);
  assert.equal(PhotoClassificationSchema.safeParse({
    photoUri: "gs://example-test/photos/sample.jpg",
    photoDefect: "DELAM",
    photoConfidence: 0.82,
  }).success, true);
  assert.equal(PhotoClassificationSchema.safeParse({
    photoUri: "gs://example-test/photos/sample.jpg",
    photoDefect: "delamination",
    photoConfidence: 0.82,
  }).success, false);
});

test("plant, locale, and currency contracts match the supported configuration", () => {
  assert.equal(PlantConfigSchema.safeParse({
    plantId: "PLANT-TEST",
    name: "Test plant",
    baseCurrency: "INR",
    costPerKg: 53.3,
    defaultLocale: "en",
  }).success, true);
  assert.equal(PlantConfigSchema.safeParse({
    plantId: "PLANT-TEST", name: "Test plant", baseCurrency: "INR", costPerKg: 53.3, defaultLocale: "mr",
  }).success, false);
  assert.equal(DisplayPrefsSchema.safeParse({ locale: "en", currency: "JPY" }).success, true);
  assert.equal(DisplayPrefsSchema.safeParse({ locale: "zh-CN", currency: "JPY" }).success, false);
  assert.equal(CurrencySchema.safeParse("INR").success, true);
  assert.equal(CurrencySchema.safeParse("IN").success, false);
  assert.equal(DefectSchema.safeParse("CRACK").success, true);
});

test("BigQuery mappers convert documented camelCase API fields to snake_case rows", () => {
  const lotRow = mapLotToBigQuery({
    lotId: "LOT-TEST-1",
    order,
    conditions,
    levers,
    sheetAreaM2: 0.6,
    boxWeightKg: 0.19,
    risk,
  });
  assert.equal(lotRow.order_id, order.orderId);
  assert.equal(lotRow.item_code, order.itemCode);
  assert.equal(lotRow.rate_delam_pct, risk.ratesPct.DELAM);
  assert.equal(mapLotFromBigQuery(lotRow).order.orderId, order.orderId);
  assert.equal(mapLotFromBigQuery(lotRow).order.itemCode, order.itemCode);
  assert.equal(mapLotFromBigQuery(lotRow).risk.currency, risk.currency);

  const sensorRow = mapSensorReadingToBigQuery({
    readingId: "READING-TEST-1",
    ts: "2026-10-10T12:00:00.000Z",
    plantId: "PLANT-TEST",
    ambientRhPct: 54,
    ambientTempC: 29,
    paperMoisturePct: 9,
    source: "simulated",
  });
  assert.equal(sensorRow.reading_id, "READING-TEST-1");
  assert.equal(sensorRow.source, "simulated");
  assert.equal(mapSensorReadingFromBigQuery(sensorRow).source, "simulated");
  assert.equal(mapSensorReadingFromBigQuery(sensorRow).plantId, "PLANT-TEST");

  const feedbackRow = mapFeedbackToBigQuery({
    jobId: "JC-TEST-1",
    lotId: "LOT-TEST-1",
    rateWarpPct: 1.3,
    photoDefect: "WARP",
  }, "2026-10-10T12:30:00.000Z");
  assert.equal(feedbackRow.job_id, "JC-TEST-1");
  assert.equal(feedbackRow.rate_warp_pct, 1.3);
  assert.equal(feedbackRow.photo_uri, null);

  const plant = {
    plantId: "PLANT-TEST",
    name: "Test plant",
    baseCurrency: "INR",
    costPerKg: 53.3,
    defaultLocale: "en",
  };
  assert.deepEqual(mapPlantFromBigQuery(mapPlantToBigQuery(plant)), plant);

  const jobRow = mapJobSheetToBigQuery(jobSheet, {
    plantId: "PLANT-TEST",
    createdAt: "2026-10-10T12:30:00.000Z",
    savingsCost: jobSheet.savings.inr,
    currency: "INR",
  });
  assert.equal(jobRow.job_id, jobSheet.jobId);
  assert.equal(jobRow.order_json.orderId, order.orderId);
  assert.equal(jobRow.savings_cost, jobSheet.savings.inr);
  assert.equal(jobRow.currency, "INR");
  assert.deepEqual(mapJobSheetFromBigQuery(jobRow), {
    jobId: jobSheet.jobId,
    createdAt: "2026-10-10T12:30:00.000Z",
    plantId: "PLANT-TEST",
    status: jobSheet.status,
    order: jobSheet.order,
    conditions: jobSheet.conditions,
    baseline: jobSheet.baseline,
    recommended: jobSheet.recommended,
    changes: jobSheet.changes,
    evidence: [],
    explanation: jobSheet.explanation,
    savings: { kg: 0.5, amount: 22.5, currency: "INR" },
    approvedAt: null,
    cardUri: null,
  });
  assert.equal(StoredJobSheetSchema.safeParse(mapJobSheetFromBigQuery(jobRow)).success, true);
});

test("risk request maps the exact 15 named parameters supplied by Om", () => {
  assert.deepEqual(mapRiskPredictionParameters({ order, conditions, levers }), {
    item_code: order.itemCode,
    quantity: order.quantity,
    paper_type: order.paperType,
    paper_supplier: order.paperSupplier,
    shift: conditions.shift,
    ambient_rh_pct: conditions.ambientRhPct,
    ambient_temp_c: conditions.ambientTempC,
    paper_moisture_pct: conditions.paperMoisturePct,
    sf_speed_mpm: levers.sfSpeedMpm,
    roll_temp_c: levers.rollTempC,
    gum_application: levers.gumApplication,
    gum_viscosity_sec: levers.gumViscositySec,
    pasting_pressure: levers.pastingPressure,
    drying_hours: levers.dryingHours,
    print_speed_spm: levers.printSpeedSpm,
  });

  const minimalSqlInput = RiskPredictionRequestSchema.parse({
    order: {
      itemCode: "PKBX0041",
      quantity: 1300,
      paperType: "RECYCLED",
      paperSupplier: "SUP-D",
    },
    conditions: {
      shift: "DAY",
      ambientRhPct: 86,
      ambientTempC: 26,
      paperMoisturePct: 10.8,
    },
    levers,
  });
  assert.deepEqual(Object.keys(mapRiskPredictionParameters(minimalSqlInput)), Object.keys(mapRiskPredictionParameters({ order, conditions, levers })));
  assert.deepEqual(
    mapRiskPredictionParameters({ ...minimalSqlInput, signal: new AbortController().signal }),
    mapRiskPredictionParameters(minimalSqlInput),
  );
});

test("cloud-dependent outputs fail explicitly while their services are unconfigured", () => {
  const expectedUnavailable = {
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "BigQuery ML is not configured.",
    },
  };
  assert.equal(ServiceUnavailableSchema.safeParse(expectedUnavailable).success, true);

  const results = [
    predictRisk(order, conditions, levers),
    optimizeLevers(order, conditions),
    findSimilarRuns(order, conditions),
    explainRisk(order, conditions, { attributions: [], similarRuns: [] }),
    generateJobSheet(order, conditions, { risk: {}, optimization: {}, evidence: [] }),
  ];
  for (const result of results) {
    assert.equal(ServiceUnavailableSchema.safeParse(result).success, true);
  }

  const conditionsResult = getConditions(conditions);
  assert.equal(conditionsResult.source, "local-validation");
  assert.equal(conditionsResult.isRealModelPrediction, false);
  assert.deepEqual(conditionsResult.data, conditions);
});
