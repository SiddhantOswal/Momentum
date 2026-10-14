import {
  FeedbackInputSchema,
  FeedbackRowSchema,
  JobSheetSchema,
  JobSheetRowSchema,
  JobSheetWriteMetadataSchema,
  LotRowSchema,
  PlantConfigSchema,
  PlantRowSchema,
  RunConditionsSchema,
  LeversSchema,
  OrderProfileSchema,
  RiskResultSchema,
  RiskPredictionRequestSchema,
  SensorReadingRowSchema,
  SensorReadingSchema,
  StoredJobSheetSchema,
} from "./schemas.js";

export function mapRiskPredictionParameters(input) {
  const requestInput = { ...input };
  delete requestInput.signal;
  const request = RiskPredictionRequestSchema.parse(requestInput);
  const { order, conditions, levers } = request;
  return Object.freeze({
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
}

export function mapLotToBigQuery(input) {
  const order = OrderProfileSchema.parse(input.order);
  const conditions = RunConditionsSchema.parse(input.conditions);
  const levers = LeversSchema.parse(input.levers);
  const risk = RiskResultSchema.parse(input.risk);

  return LotRowSchema.parse({
    lot_id: input.lotId,
    order_id: order.orderId,
    item_code: order.itemCode,
    customer_id: order.customerId,
    box_style: order.boxStyle,
    length_mm: order.lengthMm,
    width_mm: order.widthMm,
    height_mm: order.heightMm,
    ply: order.ply,
    flute_profile: order.fluteProfile,
    top_liner_gsm: order.topLinerGsm,
    flute_gsm: order.fluteGsm,
    inner_liner_gsm: order.innerLinerGsm,
    liner_bf: order.linerBf,
    paper_type: order.paperType,
    paper_supplier: order.paperSupplier,
    ink_colors: order.inkColors,
    ink_coverage_pct: order.inkCoveragePct,
    quantity: order.quantity,
    run_date: conditions.runDate,
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
    sheet_area_m2: input.sheetAreaM2,
    box_weight_kg: input.boxWeightKg,
    rate_warp_pct: risk.ratesPct.WARP,
    rate_delam_pct: risk.ratesPct.DELAM,
    rate_strength_pct: risk.ratesPct.STRENGTH,
    rate_print_pct: risk.ratesPct.PRINT,
    rate_crack_pct: risk.ratesPct.CRACK,
    total_scrap_kg: risk.totalScrapKg,
    scrap_cost: risk.scrapCost,
    currency: risk.currency,
    primary_defect: risk.primaryDefect,
  });
}

export function mapLotFromBigQuery(input) {
  const row = LotRowSchema.parse(input);

  return {
    lotId: row.lot_id,
    order: OrderProfileSchema.parse({
      orderId: row.order_id,
      itemCode: row.item_code,
      customerId: row.customer_id,
      boxStyle: row.box_style,
      lengthMm: row.length_mm,
      widthMm: row.width_mm,
      heightMm: row.height_mm,
      ply: row.ply,
      fluteProfile: row.flute_profile,
      topLinerGsm: row.top_liner_gsm,
      fluteGsm: row.flute_gsm,
      innerLinerGsm: row.inner_liner_gsm,
      linerBf: row.liner_bf,
      paperType: row.paper_type,
      paperSupplier: row.paper_supplier,
      inkColors: row.ink_colors,
      inkCoveragePct: row.ink_coverage_pct,
      quantity: row.quantity,
    }),
    conditions: RunConditionsSchema.parse({
      runDate: row.run_date,
      shift: row.shift,
      ambientRhPct: row.ambient_rh_pct,
      ambientTempC: row.ambient_temp_c,
      paperMoisturePct: row.paper_moisture_pct,
    }),
    levers: LeversSchema.parse({
      sfSpeedMpm: row.sf_speed_mpm,
      rollTempC: row.roll_temp_c,
      gumApplication: row.gum_application,
      gumViscositySec: row.gum_viscosity_sec,
      pastingPressure: row.pasting_pressure,
      dryingHours: row.drying_hours,
      printSpeedSpm: row.print_speed_spm,
    }),
    sheetAreaM2: row.sheet_area_m2,
    boxWeightKg: row.box_weight_kg,
    risk: RiskResultSchema.parse({
      ratesPct: {
        WARP: row.rate_warp_pct,
        DELAM: row.rate_delam_pct,
        STRENGTH: row.rate_strength_pct,
        PRINT: row.rate_print_pct,
        CRACK: row.rate_crack_pct,
      },
      totalScrapKg: row.total_scrap_kg,
      scrapCost: row.scrap_cost,
      currency: row.currency,
      primaryDefect: row.primary_defect,
    }),
  };
}

export function mapSensorReadingToBigQuery(input) {
  const reading = SensorReadingSchema.parse(input);

  return SensorReadingRowSchema.parse({
    reading_id: reading.readingId,
    ts: reading.ts,
    plant_id: reading.plantId,
    ambient_rh_pct: reading.ambientRhPct,
    ambient_temp_c: reading.ambientTempC,
    paper_moisture_pct: reading.paperMoisturePct,
    ...(reading.source === undefined ? {} : { source: reading.source }),
  });
}

export function mapSensorReadingFromBigQuery(input) {
  const row = SensorReadingRowSchema.parse(input);

  return SensorReadingSchema.parse({
    readingId: row.reading_id,
    ts: row.ts,
    plantId: row.plant_id,
    ambientRhPct: row.ambient_rh_pct,
    ambientTempC: row.ambient_temp_c,
    paperMoisturePct: row.paper_moisture_pct,
    ...(row.source === undefined ? {} : { source: row.source }),
  });
}

export function mapFeedbackToBigQuery(input, createdAt) {
  const feedback = FeedbackInputSchema.parse(input);

  return FeedbackRowSchema.parse({
    job_id: feedback.jobId,
    lot_id: feedback.lotId ?? null,
    created_at: createdAt,
    rate_warp_pct: feedback.rateWarpPct ?? null,
    rate_delam_pct: feedback.rateDelamPct ?? null,
    rate_strength_pct: feedback.rateStrengthPct ?? null,
    rate_print_pct: feedback.ratePrintPct ?? null,
    rate_crack_pct: feedback.rateCrackPct ?? null,
    photo_uri: feedback.photoUri ?? null,
    photo_defect: feedback.photoDefect ?? null,
    photo_confidence: feedback.photoConfidence ?? null,
    override: feedback.override ?? null,
    operator_note: feedback.operatorNote ?? null,
    operator_note_en: feedback.operatorNoteEn ?? null,
    note_lang: feedback.noteLang ?? null,
  });
}

export function mapPlantToBigQuery(input) {
  const plant = PlantConfigSchema.parse(input);

  return PlantRowSchema.parse({
    plant_id: plant.plantId,
    name: plant.name,
    base_currency: plant.baseCurrency,
    cost_per_kg: plant.costPerKg,
    default_locale: plant.defaultLocale,
  });
}

export function mapPlantFromBigQuery(input) {
  const row = PlantRowSchema.parse(input);

  return PlantConfigSchema.parse({
    plantId: row.plant_id,
    name: row.name,
    baseCurrency: row.base_currency,
    costPerKg: row.cost_per_kg,
    defaultLocale: row.default_locale,
  });
}

export function mapJobSheetToBigQuery(input, metadataInput) {
  const jobSheet = JobSheetSchema.parse(input);
  const metadata = JobSheetWriteMetadataSchema.parse(metadataInput);

  return JobSheetRowSchema.parse({
    job_id: jobSheet.jobId,
    created_at: metadata.createdAt,
    plant_id: metadata.plantId,
    status: jobSheet.status,
    order_json: jobSheet.order,
    conditions_json: jobSheet.conditions,
    baseline_json: jobSheet.baseline,
    recommended_json: jobSheet.recommended,
    changes_json: jobSheet.changes,
    evidence_json: jobSheet.evidence ?? [],
    explanation_en: jobSheet.explanation,
    savings_kg: jobSheet.savings.kg,
    savings_cost: metadata.savingsCost,
    currency: metadata.currency,
    approved_at: metadata.approvedAt,
    card_uri: metadata.cardUri,
  });
}

export function mapJobSheetFromBigQuery(input) {
  const row = JobSheetRowSchema.parse(input);

  return StoredJobSheetSchema.parse({
    jobId: row.job_id,
    createdAt: row.created_at,
    plantId: row.plant_id,
    status: row.status,
    order: row.order_json,
    conditions: row.conditions_json,
    baseline: row.baseline_json,
    recommended: row.recommended_json,
    changes: row.changes_json,
    evidence: row.evidence_json,
    explanation: row.explanation_en,
    savings: {
      kg: row.savings_kg,
      amount: row.savings_cost,
      currency: row.currency,
    },
    approvedAt: row.approved_at,
    cardUri: row.card_uri,
  });
}
