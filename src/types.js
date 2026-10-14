export {
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  LevelSchema,
  DefectSchema,
  LocaleSchema,
  CurrencySchema,
  LaunchCurrencySchema,
  DateSchema,
  TimestampSchema,
  FxRatesResponseSchema,
  FxProviderSnapshotSchema,
  OrderProfileSchema,
  JobSheetOrderSchema,
  PurchaseOrderSchema,
  CompletePurchaseOrderSchema,
  OrderExtractionInputSchema,
  PURCHASE_ORDER_FIELDS,
  MissingOrderFieldSchema,
  MissingPurchaseOrderFieldSchema,
  ValidationIssueSchema,
  ValidationFailureSchema,
  OrderExtractionResponseSchema,
  OrderExtractionResultSchema,
  OrderExtractionApiResponseSchema,
  ServiceUnavailableSchema,
  JobIdSchema,
  RunConditionsSchema,
  ManufacturingConditionsSchema,
  ConditionsSchema,
  SensorReadingSchema,
  ConditionsValidationApiResponseSchema,
  LeversSchema,
  MachineSettingsSchema,
  RiskPredictionRequestSchema,
  RiskOptimizationRequestSchema,
  RiskResultSchema,
  RiskPredictionApiResponseSchema,
  RiskSchema,
  LeverRiskProfileSchema,
  LeverChangeSchema,
  SavingsSchema,
  OptimizationResultSchema,
  OptimizationRecommendationsSchema,
  JobStatusSchema,
  SimilarRunSchema,
  JobSheetSchema,
  JobSheetResultSchema,
  StoredJobSheetSchema,
  FeedbackInputSchema,
  FeedbackRowSchema,
  FeedbackSchema,
  PhotoClassificationSchema,
  PhotoClassificationResultSchema,
  PlantConfigSchema,
  DisplayPrefsSchema,
  DisplayPrefsQuerySchema,
  InsightsQuerySchema,
  LotRowSchema,
  JobSheetRowSchema,
  JobSheetWriteMetadataSchema,
  SensorReadingRowSchema,
  PlantRowSchema,
} from "./schemas.js";

/**
 * Compatibility entry point for the original JavaScript project. JSDoc types
 * are inferred from the Zod contracts; they are not a second schema set.
 *
 * @typedef {import("./schemas.js").OrderProfile} OrderProfile
 * @typedef {import("./schemas.js").RunConditions} RunConditions
 * @typedef {import("./schemas.js").Levers} Levers
 * @typedef {import("./schemas.js").RiskResult} RiskResult
 * @typedef {import("./schemas.js").OptimizationResult} OptimizationResult
 * @typedef {import("./schemas.js").JobSheet} JobSheet
 * @typedef {import("./schemas.js").FeedbackInput} FeedbackInput
 * @typedef {import("./schemas.js").PhotoClassification} PhotoClassification
 */
