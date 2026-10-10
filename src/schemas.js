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

export const SUPPORTED_LANGUAGES = [
  "en",
  "hi",
  "mr",
  "ja",
  "ko",
  "zh-CN",
  "id",
];

export const PurchaseOrderSchema = z.object({
  orderId: z.string().trim().min(1, "orderId is required"),
  customerId: z.string().trim().min(1, "customerId is required"),
  boxStyle: z.string().trim().min(1, "boxStyle is required"),
  lengthMm: z.coerce.number().finite().positive(),
  widthMm: z.coerce.number().finite().positive(),
  heightMm: z.coerce.number().finite().positive(),
  ply: z.coerce.number().int().positive().min(1).max(12),
  fluteProfile: z.string().trim().min(1, "fluteProfile is required"),
  topLinerGsm: z.coerce.number().finite().positive(),
  fluteGsm: z.coerce.number().finite().positive(),
  innerLinerGsm: z.coerce.number().finite().positive(),
  linerBf: z.coerce.number().finite().positive(),
  paperType: z.string().trim().min(1, "paperType is required"),
  paperSupplier: z.string().trim().min(1, "paperSupplier is required"),
  inkColors: z.coerce.number().int().nonnegative().max(10),
  inkCoveragePct: z.coerce.number().min(0).max(100),
  quantity: z.coerce.number().int().positive(),
});

export const ManufacturingConditionsSchema = z.object({
  plantId: z.string().trim().min(1, "plantId is required"),
  ambientRhPct: z.coerce.number().min(0).max(100),
  ambientTempC: z.coerce.number().finite(),
  paperMoisturePct: z.coerce.number().min(0).max(100),
  timestamp: z.string().trim().min(1, "timestamp is required"),
  source: z.enum(["mock", "sensor", "manual", "api"]).default("mock"),
});

export const RiskSchema = z.object({
  warp: z.coerce.number().min(0).max(100),
  delamination: z.coerce.number().min(0).max(100),
  strengthFailure: z.coerce.number().min(0).max(100),
  printDefects: z.coerce.number().min(0).max(100),
  creaseSlotCracks: z.coerce.number().min(0).max(100),
});

export const JobStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "rejected",
]);

export const JobSheetSchema = z.object({
  jobId: z.string().trim().min(1),
  status: JobStatusSchema,
  order: PurchaseOrderSchema,
  conditions: ManufacturingConditionsSchema,
  baselineSettings: z.record(z.any()),
  recommendedSettings: z.record(z.any()),
  predictedRisks: RiskSchema,
  explanation: z.string().min(1),
  source: z.string().default("mock-demo"),
});
