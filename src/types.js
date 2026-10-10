import { z } from "zod";

export const PurchaseOrderSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().optional(),

  boxStyle: z.string().optional(),

  lengthMm: z.number().positive().optional(),
  widthMm: z.number().positive().optional(),
  heightMm: z.number().positive().optional(),

  ply: z.number().int().positive().optional(),
  fluteProfile: z.string().optional(),

  topLinerGsm: z.number().positive().optional(),
  fluteGsm: z.number().positive().optional(),
  innerLinerGsm: z.number().positive().optional(),

  linerBf: z.number().positive().optional(),
  paperType: z.string().optional(),
  paperSupplier: z.string().optional(),

  inkColors: z.number().int().nonnegative().optional(),
  inkCoveragePct: z.number().min(0).max(100).optional(),

  quantity: z.number().int().positive().optional(),
});

export const ConditionsSchema = z.object({
  ambientRhPct: z.number().min(0).max(100),
  ambientTempC: z.number(),
  paperMoisturePct: z.number().min(0).max(100),
});

export const MachineSettingsSchema = z.object({
  sfSpeedMpm: z.number().positive(),
  rollTempC: z.number(),
  gumApplication: z.enum(["low", "med", "high"]),
  gumViscositySec: z.number().positive(),
  pastingPressure: z.enum(["low", "med", "high"]),
  dryingHours: z.number().nonnegative(),
  printSpeedSpm: z.number().positive(),
});

export const RiskSchema = z.object({
  warpPct: z.number().nonnegative(),
  delamPct: z.number().nonnegative(),
  strengthPct: z.number().nonnegative(),
  printPct: z.number().nonnegative(),
  crackPct: z.number().nonnegative(),
});

export const JobStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "rejected",
]);

export const JobSheetSchema = z.object({
  jobId: z.string().min(1),
  status: JobStatusSchema,
  order: PurchaseOrderSchema,
  conditions: ConditionsSchema,
  baselineSettings: MachineSettingsSchema,
  recommendedSettings: MachineSettingsSchema,
  predictedRisks: RiskSchema,
  explanation: z.string(),
});