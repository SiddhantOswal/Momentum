const seasons = new Set(["Summer", "Monsoon", "Post-monsoon", "Winter"]);
const defects = new Set(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasFiniteNumbers(value, fields) {
  return fields.every((field) => Number.isFinite(value[field]));
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function isImpactSummary(value) {
  if (!isRecord(value) || value.ok !== true ||
      !["bigquery", "bigquery-cache"].includes(value.source) ||
      !isRecord(value.kpis) || !isRecord(value.counterfactual) ||
      !Array.isArray(value.monthly) || !Array.isArray(value.seasonal) ||
      !Array.isArray(value.topItems)) {
    return false;
  }

  const { kpis, counterfactual } = value;
  if (!isNonNegativeInteger(kpis.lotsScored) ||
      !isNonNegativeInteger(kpis.lotsChanged) ||
      kpis.lotsChanged > kpis.lotsScored ||
      !hasFiniteNumbers(kpis, [
        "netSavingMonth", "kgSavedMonth", "scrapPctBefore", "scrapPctAfter",
        "scrapCostBefore", "scrapCostAfter",
      ]) ||
      typeof kpis.currency !== "string" || !/^[A-Z]{3}$/.test(kpis.currency) ||
      kpis.scrapPctBefore < 0 || kpis.scrapPctAfter < 0 ||
      kpis.scrapCostBefore < 0 || kpis.scrapCostAfter < 0 ||
      counterfactual.month !== "2026-09" ||
      counterfactual.currency !== kpis.currency ||
      !Number.isFinite(counterfactual.scrapCost) || counterfactual.scrapCost < 0 ||
      typeof counterfactual.label !== "string" ||
      !counterfactual.label.includes("counterfactual, not observed production")) {
    return false;
  }

  if (!value.monthly.every((row) => isRecord(row) &&
      typeof row.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) &&
      isNonNegativeInteger(row.lots) &&
      hasFiniteNumbers(row, ["scrapCost", "scrapKg", "avgScrapPct"]) &&
      row.scrapCost >= 0 && row.scrapKg >= 0 && row.avgScrapPct >= 0 &&
      row.series === "simulated")) {
    return false;
  }

  if (!value.seasonal.every((row) => isRecord(row) && seasons.has(row.season) &&
      hasFiniteNumbers(row, ["warp", "delam", "strength", "print", "crack"]) &&
      ["warp", "delam", "strength", "print", "crack"].every((field) => row[field] >= 0))) {
    return false;
  }

  return value.topItems.every((row) => isRecord(row) &&
    typeof row.itemCode === "string" && row.itemCode.length > 0 &&
    typeof row.description === "string" && row.description.length > 0 &&
    isNonNegativeInteger(row.lots) &&
    hasFiniteNumbers(row, ["avgScrapPct", "scrapCost12m"]) &&
    row.avgScrapPct >= 0 && row.scrapCost12m >= 0 &&
    defects.has(row.mainDefect));
}
