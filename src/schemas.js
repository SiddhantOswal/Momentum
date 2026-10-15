import { z } from "zod";

export const SUPPORTED_CURRENCIES = [
  "INR",
  "JPY",
  "KRW",
  "CNY",
  "IDR",
  "SGD",
  "AUD",
  "THB",
  "PHP",
  "MYR",
  "USD",
];

export const SUPPORTED_LANGUAGES = ["en"];

export const LevelSchema = z.enum(["LOW", "MED", "HIGH"]);
export const DefectSchema = z.enum(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"]);
export const LocaleSchema = z.enum(SUPPORTED_LANGUAGES);
export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/);
export const LaunchCurrencySchema = z.enum(SUPPORTED_CURRENCIES);
export const DateSchema = z.iso.date();
export const TimestampSchema = z.iso.datetime({ offset: true });

const nonEmptyString = z.string().trim().min(1);
const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.nonnegative();
const purchaseOrderDate = z.string().regex(/^\d{2}-\d{2}-\d{4}$/).refine((value) => {
  const [day, month, year] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
});

const orderProfileShape = {
  orderId: nonEmptyString,
  itemCode: nonEmptyString,
  customerId: nonEmptyString,
  boxStyle: z.enum(["RSC", "DIECUT", "TRAY"]),
  lengthMm: z.number().int().min(20).max(1500),
  widthMm: z.number().int().min(20).max(1500),
  heightMm: z.number().int().min(0).max(1500),
  ply: z.union([z.literal(3), z.literal(5), z.literal(7)]),
  fluteProfile: z.enum(["B", "C", "E", "BC", "BCB"]),
  topLinerGsm: z.number().int().min(80).max(400),
  fluteGsm: z.number().int().min(80).max(400),
  innerLinerGsm: z.number().int().min(80).max(400),
  linerBf: z.number().int().min(12).max(40),
  paperType: z.enum(["VIRGIN", "RECYCLED", "MIXED"]),
  paperSupplier: nonEmptyString,
  inkColors: z.number().int().min(0).max(4),
  inkCoveragePct: finiteNumber.min(0).max(100),
  quantity: z.number().int().positive(),
};

export const OrderProfileSchema = z.object(orderProfileShape).strict();
export const JobSheetOrderSchema = z.object({
  ...orderProfileShape,
  sourcePoNumber: nonEmptyString.optional(),
  purchaseOrderLineIndex: z.number().int().nonnegative().optional(),
  purchaseOrderSourcePage: z.number().int().positive().optional(),
}).strict();
export const PurchaseOrderSchema = OrderProfileSchema;
export const CompletePurchaseOrderSchema = OrderProfileSchema;
export const OrderExtractionInputSchema = OrderProfileSchema.partial().strict();
export const OrderOperatorFieldsSchema = z.object({
  orderId: orderProfileShape.orderId.optional(),
  paperType: orderProfileShape.paperType.optional(),
  paperSupplier: orderProfileShape.paperSupplier.optional(),
}).strict();
export const OperatorItemConfirmationSchema = z.object({
  itemCode: nonEmptyString,
  quantity: z.number().int().positive(),
  lineIndex: z.number().int().nonnegative().optional(),
}).strict();
export const PurchaseOrderLineExtractionSchema = z.object({
  itemCode: nonEmptyString.optional(),
  quantity: z.number().int().positive().optional(),
  sourcePage: z.number().int().positive().optional(),
}).strict();
export const PurchaseOrderExtractionSchema = z.object({
  poNumber: nonEmptyString.optional(),
  buyer: nonEmptyString.optional(),
  deliveryDate: purchaseOrderDate.optional(),
  lines: z.array(PurchaseOrderLineExtractionSchema).min(1).max(100),
}).strict();
export const PurchaseOrderLineResultSchema = z.object({
  lineIndex: z.number().int().nonnegative(),
  sourcePage: z.number().int().positive().optional(),
  extractedItemCode: nonEmptyString.optional(),
  quantity: z.number().int().positive().optional(),
  status: z.enum(["MATCHED", "AMBIGUOUS", "UNKNOWN_CODE", "MISSING_ITEM_CODE", "MISSING_QTY", "MALFORMED"]),
  catalogStatus: z.enum(["MATCHED", "AMBIGUOUS", "UNKNOWN_CODE"]).optional(),
  validationIssues: z.array(z.enum([
    "ITEM_CODE_INVALID",
    "QUANTITY_INVALID",
    "SOURCE_PAGE_INVALID",
    "SOURCE_PAGE_MISSING",
    "LINE_INVALID",
  ])).optional(),
  candidates: z.array(nonEmptyString),
  resolvedItemCode: nonEmptyString.optional(),
  confirmedItemCode: nonEmptyString.optional(),
  confirmedQuantity: z.number().int().positive().optional(),
  orderProfile: OrderExtractionInputSchema.optional(),
}).strict();
export const PurchaseOrderDocumentSchema = z.object({
  poNumber: nonEmptyString.optional(),
  buyer: nonEmptyString.optional(),
  deliveryDate: purchaseOrderDate.optional(),
}).strict();
export const PURCHASE_ORDER_FIELDS = Object.keys(orderProfileShape);
export const MissingOrderFieldSchema = z.enum(PURCHASE_ORDER_FIELDS);
export const MissingPurchaseOrderFieldSchema = MissingOrderFieldSchema;

export const ValidationIssueSchema = z.object({
  field: nonEmptyString,
  path: z.array(z.union([z.string(), z.number()])),
  code: nonEmptyString,
  message: nonEmptyString,
}).strict();

export const ValidationFailureSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.literal("VALIDATION_ERROR"),
    message: nonEmptyString,
    issues: z.array(ValidationIssueSchema).min(1),
  }).strict(),
}).strict();

export const OrderExtractionResponseSchema = z.object({
  orderProfile: OrderExtractionInputSchema.optional(),
  purchaseOrderDocument: PurchaseOrderDocumentSchema.optional(),
  documentMissingFields: z.array(z.enum(["poNumber", "buyer", "deliveryDate"])).optional(),
  lines: z.array(PurchaseOrderLineResultSchema).optional(),
  selectedLineIndex: z.number().int().nonnegative().optional(),
  lineSelectionRequired: z.boolean().optional(),
  reviewId: z.string().uuid().optional(),
  reviewFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  missingFields: z.array(MissingOrderFieldSchema),
  needsClarification: z.boolean(),
}).strict().refine(
  (result) => result.needsClarification === (
    result.missingFields.length > 0 || result.lineSelectionRequired === true ||
    result.documentMissingFields?.length > 0 ||
    result.lines?.some((line) => line.status !== "MATCHED") === true
  ),
  { message: "needsClarification must reflect missing fields and unresolved PO lines." }
);

export const OrderExtractionResultSchema = z.union([
  OrderExtractionResponseSchema,
  ValidationFailureSchema,
]);

export const OrderExtractionApiResponseSchema = z.object({
  ok: z.literal(true),
  agent: z.literal("extractOrder"),
  source: z.enum(["mock-demo", "vertex-gemini"]),
  isRealModelPrediction: z.boolean(),
  orderProfile: OrderExtractionInputSchema.optional(),
  purchaseOrderDocument: PurchaseOrderDocumentSchema.optional(),
  documentMissingFields: z.array(z.enum(["poNumber", "buyer", "deliveryDate"])).optional(),
  lines: z.array(PurchaseOrderLineResultSchema).optional(),
  selectedLineIndex: z.number().int().nonnegative().optional(),
  lineSelectionRequired: z.boolean().optional(),
  reviewId: z.string().uuid().optional(),
  reviewFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  missingFields: z.array(MissingOrderFieldSchema),
  needsClarification: z.boolean(),
  sourceDocumentUri: z.string().regex(/^gs:\/\/[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9._/-]+$/).optional(),
  operatorProvidedFields: z.array(z.enum(["orderId", "paperType", "paperSupplier"])).optional(),
  modelUsage: z.object({
    promptTokenCount: z.number().int().nonnegative().optional(),
    candidatesTokenCount: z.number().int().nonnegative().optional(),
    totalTokenCount: z.number().int().nonnegative().optional(),
    cachedContentTokenCount: z.number().int().nonnegative().optional(),
    thoughtsTokenCount: z.number().int().nonnegative().optional(),
  }).strict().optional(),
}).strict().refine(
  (result) => result.needsClarification === (
    result.missingFields.length > 0 || result.lineSelectionRequired === true ||
    result.documentMissingFields?.length > 0 ||
    result.lines?.some((line) => line.status !== "MATCHED") === true
  ),
  { message: "needsClarification must reflect missing fields and unresolved PO lines." }
);

export const ServiceUnavailableSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.literal("SERVICE_UNAVAILABLE"),
    message: nonEmptyString,
  }).strict(),
}).strict();

export const JobIdSchema = nonEmptyString;

export const RunConditionsSchema = z.object({
  runDate: DateSchema,
  shift: z.enum(["DAY", "NIGHT"]),
  ambientRhPct: finiteNumber.min(0).max(100),
  ambientTempC: finiteNumber,
  paperMoisturePct: finiteNumber.min(0).max(20),
}).strict();
export const ManufacturingConditionsSchema = RunConditionsSchema;
export const ConditionsSchema = RunConditionsSchema;
export const SensorProvenanceSchema = z.object({
  readingId: nonEmptyString,
  timestamp: TimestampSchema,
  plantId: nonEmptyString,
  source: z.enum(["simulated", "live", "unverified"]),
  recordedSource: nonEmptyString,
  retrievedAt: TimestampSchema,
  ageSeconds: nonNegativeNumber,
  freshness: z.enum(["fresh", "stale", "unassessed"]),
}).strict();
export const JobSheetConditionsSchema = RunConditionsSchema.extend({
  provenance: SensorProvenanceSchema.optional(),
  conditionSource: z.enum(["manual-entry", "simulated-sensor"]).optional(),
  supervisorConfirmed: z.boolean().optional(),
}).strict();

export const SensorReadingSchema = z.object({
  readingId: nonEmptyString,
  ts: TimestampSchema,
  plantId: nonEmptyString,
  ambientRhPct: finiteNumber.min(0).max(100),
  ambientTempC: finiteNumber,
  paperMoisturePct: finiteNumber.min(0).max(20),
  source: z.enum(["simulated", "live"]).optional(),
}).strict();

export const ConditionsValidationApiResponseSchema = z.object({
  ok: z.literal(true),
  agent: z.literal("getConditions"),
  source: z.enum(["local-validation", "bigquery-last-stored", "simulated-sensor"]),
  isRealModelPrediction: z.literal(false),
  data: RunConditionsSchema,
  sensorSource: z.enum(["simulated", "live", "unverified"]).optional(),
  provenance: SensorProvenanceSchema.optional(),
}).strict();

export const LeversSchema = z.object({
  sfSpeedMpm: finiteNumber.min(20).max(60),
  rollTempC: finiteNumber.min(150).max(185),
  gumApplication: LevelSchema,
  gumViscositySec: finiteNumber.min(25).max(60),
  pastingPressure: LevelSchema,
  dryingHours: finiteNumber.min(2).max(16),
  printSpeedSpm: finiteNumber.min(30).max(80),
}).strict();
export const MachineSettingsSchema = LeversSchema;

export const RiskPredictionRequestSchema = z.object({
  // Om's predict.sql joins the authoritative item spec by item_code, so the
  // prediction request needs only the item identity, quantity and loaded reel.
  order: z.object({
    itemCode: nonEmptyString,
    quantity: z.number().int().positive(),
    paperType: z.enum(["VIRGIN", "RECYCLED", "MIXED"]),
    paperSupplier: nonEmptyString,
  }),
  conditions: z.object({
    shift: z.enum(["DAY", "NIGHT"]),
    ambientRhPct: finiteNumber.min(0).max(100),
    ambientTempC: finiteNumber,
    paperMoisturePct: finiteNumber.min(0).max(20),
  }),
  conditionsConfirmed: z.literal(true).optional(),
  levers: LeversSchema,
}).strict();

export const RiskOptimizationRequestSchema = z.object({
  order: OrderProfileSchema,
  conditions: RunConditionsSchema,
  conditionsConfirmed: z.literal(true).optional(),
  levers: LeversSchema,
}).strict();

export const RiskResultSchema = z.object({
  ratesPct: z.record(DefectSchema, finiteNumber.min(0).max(25)),
  totalScrapPct: finiteNumber.min(0).max(125).optional(),
  totalScrapKg: nonNegativeNumber,
  scrapCost: nonNegativeNumber,
  currency: CurrencySchema,
  primaryDefect: DefectSchema,
}).strict();
export const RiskSchema = RiskResultSchema;

const ModelEvaluationOutputSchema = z.object({
  defect: DefectSchema,
  resource: nonEmptyString,
  r2: finiteNumber.nullable(),
  modelVersion: nonEmptyString.nullable(),
  sampleCount: z.number().int().nonnegative().nullable(),
}).strict();
const FiveModelEvaluationSetSchema = z.array(ModelEvaluationOutputSchema).length(5).refine(
  (models) => new Set(models.map((model) => model.defect)).size === 5,
  { message: "Each defect must map to one distinct model evaluation record." }
);

export const RiskPredictionApiResponseSchema = z.object({
  ok: z.literal(true),
  agent: z.literal("predictRisk"),
  source: z.literal("bigquery-ml"),
  isRealModelPrediction: z.literal(true),
  itemCode: nonEmptyString,
  ...RiskResultSchema.shape,
  modelProvenance: z.object({
    query: z.literal("sql/predict.sql"),
    outputs: FiveModelEvaluationSetSchema,
    currentModelVersionsLinked: z.boolean(),
  }).strict(),
  modelAcceptance: z.object({
    status: z.enum(["accepted", "blocked", "prototype-thresholds-met"]),
    requiredR2: z.object({
      WARP: finiteNumber,
      DELAM: finiteNumber,
      STRENGTH: finiteNumber,
      PRINT: finiteNumber,
      CRACK: finiteNumber,
    }).strict(),
    prototypeThresholdsMet: z.boolean(),
    completeAcceptanceEvidenceAvailable: z.boolean(),
    evaluationId: nonEmptyString.nullable(),
    evaluatedAt: nonEmptyString.nullable(),
    split: nonEmptyString.nullable(),
    linkedToCurrentResourceVersions: z.boolean(),
    models: z.array(ModelEvaluationOutputSchema),
    notes: z.array(nonEmptyString),
  }).strict(),
}).strict();

export const LeverRiskProfileSchema = z.object({
  levers: LeversSchema,
  risk: RiskResultSchema,
}).strict();

export const LeverChangeSchema = z.object({
  lever: z.enum([
    "sfSpeedMpm",
    "rollTempC",
    "gumApplication",
    "gumViscositySec",
    "pastingPressure",
    "dryingHours",
    "printSpeedSpm",
  ]),
  from: z.union([finiteNumber, nonEmptyString]),
  to: z.union([finiteNumber, nonEmptyString]),
  reason: nonEmptyString,
}).strict();

export const SavingsSchema = z.object({
  kg: finiteNumber,
  inr: finiteNumber,
  percent: finiteNumber.min(0).max(100).optional(),
}).strict();

export const OptimizationResultSchema = z.object({
  baseline: LeverRiskProfileSchema,
  best: LeverRiskProfileSchema,
  changes: z.array(LeverChangeSchema).max(3),
  savings: SavingsSchema,
  modelPredicted: z.literal(true).optional(),
  note: nonEmptyString.optional(),
}).strict();
export const OptimizationRecommendationsSchema = OptimizationResultSchema;

export const JobStatusSchema = z.enum(["DRAFT", "APPROVED", "RUN", "CLOSED"]);

export const SimilarRunSchema = z.object({
  lotId: nonEmptyString,
  orderId: nonEmptyString,
  runDate: DateSchema,
  primaryDefect: DefectSchema,
  levers: LeversSchema,
  ratesPct: z.record(DefectSchema, finiteNumber.min(0).max(25)).optional(),
  itemCode: nonEmptyString.optional(),
  description: nonEmptyString.optional(),
  shift: z.enum(["DAY", "NIGHT"]).optional(),
  ambientRhPct: finiteNumber.min(0).max(100).optional(),
  paperType: z.enum(["VIRGIN", "RECYCLED", "MIXED"]).optional(),
  paperSupplier: nonEmptyString.optional(),
  totalScrapPct: nonNegativeNumber.optional(),
  totalScrapKg: nonNegativeNumber.optional(),
  scrapCost: nonNegativeNumber.optional(),
  currency: CurrencySchema.optional(),
  distance: finiteNumber.optional(),
  operatorNote: z.string().optional(),
}).strict();

export const SimilarRunsRequestSchema = z.object({
  order: OrderProfileSchema,
  conditions: RunConditionsSchema,
}).strict();

export const RiskExplanationRequestSchema = z.object({
  order: OrderProfileSchema,
  conditions: RunConditionsSchema,
  prediction: RiskResultSchema,
  optimization: OptimizationResultSchema,
  evidence: z.array(SimilarRunSchema).max(5),
}).strict();

export const JobSheetSchema = z.object({
  jobId: nonEmptyString,
  plantId: nonEmptyString.optional(),
  order: JobSheetOrderSchema,
  conditions: JobSheetConditionsSchema,
  baseline: LeverRiskProfileSchema,
  recommended: LeverRiskProfileSchema,
  changes: z.array(LeverChangeSchema).max(3),
  evidence: z.array(SimilarRunSchema).max(5).optional(),
  explanation: nonEmptyString,
  savings: SavingsSchema,
  status: JobStatusSchema,
}).strict();

export const JobSheetResultSchema = JobSheetSchema;

export const FeedbackInputSchema = z.object({
  jobId: nonEmptyString,
  lotId: nonEmptyString.optional(),
  rateWarpPct: finiteNumber.min(0).max(25).optional(),
  rateDelamPct: finiteNumber.min(0).max(25).optional(),
  rateStrengthPct: finiteNumber.min(0).max(25).optional(),
  ratePrintPct: finiteNumber.min(0).max(25).optional(),
  rateCrackPct: finiteNumber.min(0).max(25).optional(),
  photoUri: nonEmptyString.optional(),
  photoDefect: DefectSchema.optional(),
  photoConfidence: nonNegativeNumber.optional(),
  override: z.boolean().optional(),
  operatorNote: z.string().optional(),
  operatorNoteEn: z.string().optional(),
  noteLang: LocaleSchema.optional(),
}).strict().refine(
  (feedback) =>
    [
      feedback.rateWarpPct,
      feedback.rateDelamPct,
      feedback.rateStrengthPct,
      feedback.ratePrintPct,
      feedback.rateCrackPct,
    ].some((rate) => rate !== undefined) ||
    feedback.photoUri !== undefined,
  {
    message: "Feedback must include at least one actual defect rate or photo.",
  }
);

export const FeedbackRowSchema = z.object({
  job_id: nonEmptyString,
  lot_id: nonEmptyString.nullable(),
  created_at: TimestampSchema,
  rate_warp_pct: finiteNumber.min(0).max(25).nullable(),
  rate_delam_pct: finiteNumber.min(0).max(25).nullable(),
  rate_strength_pct: finiteNumber.min(0).max(25).nullable(),
  rate_print_pct: finiteNumber.min(0).max(25).nullable(),
  rate_crack_pct: finiteNumber.min(0).max(25).nullable(),
  photo_uri: nonEmptyString.nullable(),
  photo_defect: DefectSchema.nullable(),
  photo_confidence: nonNegativeNumber.nullable(),
  override: z.boolean().nullable(),
  operator_note: z.string().nullable(),
  operator_note_en: z.string().nullable(),
  note_lang: LocaleSchema.nullable(),
}).strict();
export const FeedbackSchema = FeedbackInputSchema;

export const PhotoClassificationSchema = z.object({
  photoUri: nonEmptyString,
  photoDefect: DefectSchema,
  photoConfidence: nonNegativeNumber,
}).strict();

export const PhotoClassificationResultSchema = PhotoClassificationSchema;

export const PlantConfigSchema = z.object({
  plantId: nonEmptyString,
  name: nonEmptyString,
  baseCurrency: CurrencySchema,
  costPerKg: finiteNumber.positive(),
  defaultLocale: LocaleSchema,
}).strict();

export const DisplayPrefsSchema = z.object({
  locale: LocaleSchema,
  currency: CurrencySchema,
}).strict();

export const DisplayPrefsQuerySchema = z.object({
  lang: LocaleSchema.optional(),
  currency: CurrencySchema.optional(),
}).strict();

export const InsightsQuerySchema = z.object({
  from: DateSchema.optional(),
  to: DateSchema.optional(),
}).strict().refine(
  (query) => query.from === undefined || query.to === undefined || query.from <= query.to,
  { message: "from must be on or before to.", path: ["from"] }
);

export const SeenBeforeRequestSchema = z.object({
  defect: DefectSchema,
  ambientRhPct: finiteNumber.min(0).max(100),
}).strict();

export const FxRatesResponseSchema = z.object({
  base: CurrencySchema,
  date: DateSchema,
  rates: z.record(CurrencySchema, finiteNumber.positive()),
  source: z.enum(["frankfurter", "static-fallback"]),
}).strict();

export const FxProviderSnapshotSchema = z.object({
  base: z.literal("INR"),
  date: DateSchema,
  rates: z.record(CurrencySchema, finiteNumber.positive()),
}).strict();

export const LotRowSchema = z.object({
  lot_id: nonEmptyString,
  order_id: nonEmptyString,
  item_code: nonEmptyString,
  customer_id: nonEmptyString,
  box_style: z.enum(["RSC", "DIECUT", "TRAY"]),
  length_mm: z.number().int().min(20).max(1500),
  width_mm: z.number().int().min(20).max(1500),
  height_mm: z.number().int().min(0).max(1500),
  ply: z.union([z.literal(3), z.literal(5), z.literal(7)]),
  flute_profile: z.enum(["B", "C", "E", "BC", "BCB"]),
  top_liner_gsm: z.number().int().min(80).max(400),
  flute_gsm: z.number().int().min(80).max(400),
  inner_liner_gsm: z.number().int().min(80).max(400),
  liner_bf: z.number().int().min(12).max(40),
  paper_type: z.enum(["VIRGIN", "RECYCLED", "MIXED"]),
  paper_supplier: nonEmptyString,
  ink_colors: z.number().int().min(0).max(4),
  ink_coverage_pct: finiteNumber.min(0).max(100),
  quantity: z.number().int().positive(),
  run_date: DateSchema,
  shift: z.enum(["DAY", "NIGHT"]),
  ambient_rh_pct: finiteNumber.min(0).max(100),
  ambient_temp_c: finiteNumber,
  paper_moisture_pct: finiteNumber.min(0).max(20),
  sf_speed_mpm: finiteNumber.min(20).max(60),
  roll_temp_c: finiteNumber.min(150).max(185),
  gum_application: LevelSchema,
  gum_viscosity_sec: finiteNumber.min(25).max(60),
  pasting_pressure: LevelSchema,
  drying_hours: finiteNumber.min(2).max(16),
  print_speed_spm: finiteNumber.min(30).max(80),
  sheet_area_m2: nonNegativeNumber,
  box_weight_kg: nonNegativeNumber,
  rate_warp_pct: finiteNumber.min(0).max(25),
  rate_delam_pct: finiteNumber.min(0).max(25),
  rate_strength_pct: finiteNumber.min(0).max(25),
  rate_print_pct: finiteNumber.min(0).max(25),
  rate_crack_pct: finiteNumber.min(0).max(25),
  total_scrap_kg: nonNegativeNumber,
  scrap_cost: nonNegativeNumber,
  currency: CurrencySchema,
  primary_defect: DefectSchema,
}).strict();

export const ApprovalAuditSchema = z.object({
  jobId: nonEmptyString,
  actorUid: z.string().regex(/^[A-Za-z0-9:_-]{1,128}$/),
  actorType: z.literal("HACKATHON_DEMO_PARTICIPANT").optional(),
  authorizationMode: z.literal("HACKATHON_DEMO").optional(),
  identityProvider: z.literal("server-signed-demo-session").optional(),
  authenticatedHuman: z.literal(false).optional(),
  action: z.literal("APPROVE"),
  previousStatus: z.literal("DRAFT"),
  newStatus: z.literal("APPROVED"),
  decidedAt: TimestampSchema,
  correlationId: z.string().uuid(),
  decisionId: z.string().uuid(),
  cardUri: z.string().regex(/^gs:\/\/prepagent-hack-data\/jobcards\/[A-Za-z0-9._%/-]+\.pdf$/),
}).strict().superRefine((audit, ctx) => {
  const demo = audit.actorUid.startsWith("demo:") || audit.jobId.startsWith("JOB-HACK-") ||
    [audit.actorType, audit.authorizationMode, audit.identityProvider, audit.authenticatedHuman].some(value => value !== undefined);
  if (demo && (audit.actorType !== "HACKATHON_DEMO_PARTICIPANT" || audit.authorizationMode !== "HACKATHON_DEMO" ||
      audit.identityProvider !== "server-signed-demo-session" || audit.authenticatedHuman !== false ||
      !/^demo:[a-f0-9]{32}$/.test(audit.actorUid) ||
      !new RegExp(`^JOB-HACK-${audit.actorUid.slice(5)}-[a-f0-9]{40}$`).test(audit.jobId))) {
    ctx.addIssue({ code: "custom", message: "Demo approval requires complete matching session provenance." });
  }
});

export const JobSheetRowSchema = z.object({
  job_id: nonEmptyString,
  created_at: TimestampSchema,
  plant_id: nonEmptyString,
  status: JobStatusSchema,
  order_json: z.record(z.string(), z.unknown()),
  conditions_json: z.record(z.string(), z.unknown()),
  baseline_json: z.record(z.string(), z.unknown()),
  recommended_json: z.record(z.string(), z.unknown()),
  changes_json: z.array(z.unknown()),
  evidence_json: z.array(z.unknown()),
  explanation_en: nonEmptyString,
  savings_kg: finiteNumber,
  savings_cost: finiteNumber,
  currency: CurrencySchema,
  approved_at: TimestampSchema.nullable(),
  card_uri: nonEmptyString.nullable(),
  approval_audit_json: ApprovalAuditSchema.nullable().optional(),
}).strict();

export const StoredJobSheetSchema = z.object({
  jobId: nonEmptyString,
  createdAt: TimestampSchema,
  plantId: nonEmptyString,
  status: JobStatusSchema,
  order: JobSheetOrderSchema,
  conditions: JobSheetConditionsSchema,
  baseline: LeverRiskProfileSchema,
  recommended: LeverRiskProfileSchema,
  changes: z.array(LeverChangeSchema).max(3),
  evidence: z.array(SimilarRunSchema),
  explanation: nonEmptyString,
  savings: z.object({
    kg: finiteNumber,
    amount: finiteNumber,
    currency: CurrencySchema,
  }).strict(),
  approvedAt: TimestampSchema.nullable(),
  cardUri: nonEmptyString.nullable(),
  approvalAudit: ApprovalAuditSchema.nullable().optional(),
}).strict();

export const JobSheetWriteMetadataSchema = z.object({
  plantId: nonEmptyString,
  createdAt: TimestampSchema,
  savingsCost: finiteNumber,
  currency: CurrencySchema,
  approvedAt: TimestampSchema.nullable().default(null),
  cardUri: nonEmptyString.nullable().default(null),
}).strict();

export const SensorReadingRowSchema = z.object({
  reading_id: nonEmptyString,
  ts: TimestampSchema,
  plant_id: nonEmptyString,
  ambient_rh_pct: finiteNumber.min(0).max(100),
  ambient_temp_c: finiteNumber,
  paper_moisture_pct: finiteNumber.min(0).max(20),
  source: z.enum(["simulated", "live"]).optional(),
}).strict();

export const PlantRowSchema = z.object({
  plant_id: nonEmptyString,
  name: nonEmptyString,
  base_currency: CurrencySchema,
  cost_per_kg: finiteNumber.positive(),
  default_locale: LocaleSchema,
}).strict();

/**
 * JavaScript types are derived from Zod at editor/type-aware tooling time.
 * The validators remain the single source of truth.
 *
 * @typedef {import("zod").infer<typeof OrderProfileSchema>} OrderProfile
 * @typedef {import("zod").infer<typeof RunConditionsSchema>} RunConditions
 * @typedef {import("zod").infer<typeof LeversSchema>} Levers
 * @typedef {import("zod").infer<typeof RiskResultSchema>} RiskResult
 * @typedef {import("zod").infer<typeof OptimizationResultSchema>} OptimizationResult
 * @typedef {import("zod").infer<typeof JobSheetSchema>} JobSheet
 * @typedef {import("zod").infer<typeof FeedbackInputSchema>} FeedbackInput
 * @typedef {import("zod").infer<typeof PhotoClassificationSchema>} PhotoClassification
 */
