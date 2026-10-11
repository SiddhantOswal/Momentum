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

export const SUPPORTED_LANGUAGES = ["en", "hi", "mr", "ja", "ko", "zh-CN", "id"];

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

const orderProfileShape = {
  orderId: nonEmptyString,
  customerId: nonEmptyString,
  boxStyle: z.enum(["RSC", "DIECUT", "TRAY"]),
  lengthMm: z.number().int().min(50).max(1200),
  widthMm: z.number().int().min(50).max(1200),
  heightMm: z.number().int().min(50).max(1200),
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
export const PurchaseOrderSchema = OrderProfileSchema;
export const CompletePurchaseOrderSchema = OrderProfileSchema;
export const OrderExtractionInputSchema = OrderProfileSchema.partial().strict();
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
  orderProfile: OrderExtractionInputSchema,
  missingFields: z.array(MissingOrderFieldSchema),
  needsClarification: z.boolean(),
}).strict().refine(
  (result) => result.needsClarification === (result.missingFields.length > 0),
  { message: "needsClarification must reflect whether missingFields is empty." }
);

export const OrderExtractionResultSchema = z.union([
  OrderExtractionResponseSchema,
  ValidationFailureSchema,
]);

export const OrderExtractionApiResponseSchema = z.object({
  ok: z.literal(true),
  agent: z.literal("extractOrder"),
  source: z.literal("mock-demo"),
  isRealModelPrediction: z.literal(false),
  orderProfile: OrderExtractionInputSchema,
  missingFields: z.array(MissingOrderFieldSchema),
  needsClarification: z.boolean(),
}).strict().refine(
  (result) => result.needsClarification === (result.missingFields.length > 0),
  { message: "needsClarification must reflect whether missingFields is empty." }
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

export const SensorReadingSchema = z.object({
  readingId: nonEmptyString,
  ts: TimestampSchema,
  plantId: nonEmptyString,
  ambientRhPct: finiteNumber.min(0).max(100),
  ambientTempC: finiteNumber,
  paperMoisturePct: finiteNumber.min(0).max(20),
}).strict();

export const ConditionsValidationApiResponseSchema = z.object({
  ok: z.literal(true),
  agent: z.literal("getConditions"),
  source: z.literal("local-validation"),
  isRealModelPrediction: z.literal(false),
  data: RunConditionsSchema,
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
  order: OrderProfileSchema,
  conditions: RunConditionsSchema,
  levers: LeversSchema,
}).strict();

export const RiskOptimizationRequestSchema = z.object({
  order: OrderProfileSchema,
  conditions: RunConditionsSchema,
}).strict();

export const RiskResultSchema = z.object({
  ratesPct: z.record(DefectSchema, finiteNumber.min(0).max(25)),
  totalScrapKg: nonNegativeNumber,
  scrapCost: nonNegativeNumber,
  currency: CurrencySchema,
  primaryDefect: DefectSchema,
}).strict();
export const RiskSchema = RiskResultSchema;

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
}).strict();

export const OptimizationResultSchema = z.object({
  baseline: LeverRiskProfileSchema,
  best: LeverRiskProfileSchema,
  changes: z.array(LeverChangeSchema).max(3),
  savings: SavingsSchema,
}).strict();
export const OptimizationRecommendationsSchema = OptimizationResultSchema;

export const JobStatusSchema = z.enum(["DRAFT", "APPROVED", "RUN", "CLOSED"]);

export const SimilarRunSchema = z.object({
  lotId: nonEmptyString,
  orderId: nonEmptyString,
  runDate: DateSchema,
  primaryDefect: DefectSchema,
  ratesPct: z.record(DefectSchema, finiteNumber.min(0).max(25)),
  levers: LeversSchema,
}).strict();

export const JobSheetSchema = z.object({
  jobId: nonEmptyString,
  plantId: nonEmptyString.optional(),
  order: OrderProfileSchema,
  conditions: RunConditionsSchema,
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
  customer_id: nonEmptyString,
  box_style: z.enum(["RSC", "DIECUT", "TRAY"]),
  length_mm: z.number().int().min(50).max(1200),
  width_mm: z.number().int().min(50).max(1200),
  height_mm: z.number().int().min(50).max(1200),
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
}).strict();

export const StoredJobSheetSchema = z.object({
  jobId: nonEmptyString,
  createdAt: TimestampSchema,
  plantId: nonEmptyString,
  status: JobStatusSchema,
  order: OrderProfileSchema,
  conditions: RunConditionsSchema,
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
