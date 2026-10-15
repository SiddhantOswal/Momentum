import { DEFECT_NAMES, LEVER_FIELDS, ORDER_FIELDS, CONDITION_FIELDS } from './fields.js';
const finite = (v) => Number.isFinite(v);
const nonnegative = (v) => finite(v) && v >= 0;
const validLevers = (value) => value && LEVER_FIELDS.every(([key,,type,min,max]) => type === 'number'
  ? finite(value[key]) && value[key] >= min && value[key] <= max : min.includes(value[key]));
export function isRiskDisplay(value) {
  return !!(value && value.ratesPct && Object.keys(DEFECT_NAMES).every((key) => finite(value.ratesPct[key]) && value.ratesPct[key] >= 0 && value.ratesPct[key] <= 25)
    && nonnegative(value.totalScrapKg) && nonnegative(value.scrapCost) && /^[A-Z]{3}$/.test(value.currency)
    && Object.hasOwn(DEFECT_NAMES, value.primaryDefect)
    && (value.totalScrapPct === undefined || nonnegative(value.totalScrapPct) && value.totalScrapPct <= 125));
}
export function isOptimizationDisplay(value) {
  return !!(value?.baseline && value?.best && validLevers(value.baseline.levers) && validLevers(value.best.levers)
    && isRiskDisplay(value.baseline.risk) && isRiskDisplay(value.best.risk) && Array.isArray(value.changes) && value.changes.length <= 3
    && value.changes.every((c) => LEVER_FIELDS.some(([key]) => key === c?.lever) && c.from !== undefined && c.to !== undefined && typeof c.reason === 'string')
    && finite(value.savings?.kg) && finite(value.savings?.inr)
    && (value.savings.percent === undefined || nonnegative(value.savings.percent) && value.savings.percent <= 100));
}
export function isSeenBefore(value) {
  const groupValid = (group) => group === null || (group && Number.isSafeInteger(group.lots) && group.lots >= 0 && nonnegative(group.avgRatePct) && group.avgRatePct <= 25 && validLevers(group));
  return value?.ok === true && value.source === 'bigquery' && Object.hasOwn(DEFECT_NAMES, value.defect)
    && Number.isSafeInteger(value.caseCount) && value.caseCount >= 0 && nonnegative(value.avgRateWhenMain) && value.avgRateWhenMain <= 25
    && nonnegative(value.costWhenMain) && groupValid(value.goodRuns) && groupValid(value.badRuns)
    && Array.isArray(value.notes) && value.notes.every((n) => typeof n === 'string');
}
const validFields = (value, fields) => !!value && fields.every(([key,,type,min,max]) => type === 'select' ? min.includes(String(value[key]))
  : type === 'number' ? finite(value[key]) && (min === undefined || value[key] >= min) && (max === undefined || value[key] <= max)
  : typeof value[key] === 'string' && value[key].trim().length > 0);
export function isConditionsDisplay(value) {
  return validFields(value, CONDITION_FIELDS) && /^\d{4}-\d{2}-\d{2}$/.test(value.runDate);
}
export function isJobDisplay(value) {
  return !!(value && typeof value.jobId === 'string' && value.jobId.trim() && ['DRAFT','APPROVED','RUN','CLOSED'].includes(value.status)
    && validFields(value.order, ORDER_FIELDS) && Number.isSafeInteger(value.order.quantity) && value.order.quantity > 0
    && isConditionsDisplay(value.conditions) && typeof value.explanation === 'string' && value.explanation.trim()
    && isOptimizationDisplay({baseline:value.baseline,best:value.recommended,changes:value.changes,savings:value.savings}));
}
