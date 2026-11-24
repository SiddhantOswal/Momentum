import { countedDefects, TargetUseSchema } from "./schemas.js";

/**
 * Reads the per-target use classes from a model acceptance record. Returns
 * null when any target is missing or malformed, so callers can fail closed
 * instead of treating an unlabelled target as usable.
 */
export function readTargetUse(record) {
  const parsed = TargetUseSchema.safeParse(record?.targetUse);
  return parsed.success ? Object.freeze(parsed.data) : null;
}

/** The @optimizer_targets query parameter for predict.sql, optimize.sql and impact_batch.sql. */
export function optimizerTargetsParameter(targetUse) {
  if (!TargetUseSchema.safeParse(targetUse).success) {
    throw new TypeError("A complete per-target use-class map is required.");
  }
  return { type: "ARRAY<STRING>", value: countedDefects(targetUse) };
}

/** The same parameter as a bq command-line flag, for scripts run by hand such as impact_batch.sql. */
export function optimizerTargetsBqFlag(targetUse) {
  const { value } = optimizerTargetsParameter(targetUse);
  return `--parameter=optimizer_targets:ARRAY<STRING>:${JSON.stringify(value)}`;
}
