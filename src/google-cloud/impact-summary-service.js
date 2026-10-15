import { readFileSync } from "node:fs";
import { BigQueryReadError } from "./bigquery-read-client.js";

const KPI_COLUMNS = Object.freeze([
  "lots_scored", "lots_changed", "net_saving_month", "kg_saved_month",
  "scrap_pct_before", "scrap_pct_after", "scrap_cost_before", "scrap_cost_after", "currency",
]);
const MONTHLY_COLUMNS = Object.freeze(["month", "lots", "scrap_cost", "scrap_kg", "avg_scrap_pct"]);
const SEASONAL_COLUMNS = Object.freeze(["season", "warp", "delam", "strength", "print", "crack"]);
const TOP_ITEM_COLUMNS = Object.freeze([
  "item_code", "lots", "avg_scrap_pct", "scrap_cost_12m", "main_defect",
]);
const SEASONS = new Set(["Summer", "Monsoon", "Post-monsoon", "Winter"]);

function loadQuery(sql, name) {
  const query = sql ?? readFileSync(new URL(`../../sql/${name}`, import.meta.url), "utf8");
  if (typeof query !== "string" || !new RegExp(`^\\s*--[^\\n]*${name.replace(".", "\\.")}`, "i").test(query) ||
      !/^\s*(?:--[^\n]*\n\s*)*SELECT\b/i.test(query)) {
    throw new TypeError(`The supplied read-only ${name} is required.`);
  }
  return query;
}

function decodeRows(result, columns) {
  const fields = result?.schema?.fields;
  if (!Array.isArray(fields) || fields.length !== columns.length ||
      fields.some((field, index) => field.name !== columns[index])) {
    throw new BigQueryReadError("IMPACT_SCHEMA_MISMATCH", "Impact query returned an unexpected result schema.");
  }
  return (result.rows ?? []).map((row) => {
    if (!Array.isArray(row.f) || row.f.length !== fields.length) {
      throw new BigQueryReadError("IMPACT_ROW_INVALID", "Impact query returned an invalid result row.");
    }
    return Object.fromEntries(fields.map((field, index) => [field.name, row.f[index]?.v ?? null]));
  });
}

function number(value, field) {
  const parsed = Number(value);
  if (value === null || value === undefined || !Number.isFinite(parsed)) {
    throw new BigQueryReadError("IMPACT_ROW_INVALID", `Impact query returned an invalid ${field}.`);
  }
  return parsed;
}

function count(value, field) {
  const parsed = number(value, field);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new BigQueryReadError("IMPACT_ROW_INVALID", `Impact query returned an invalid ${field}.`);
  }
  return parsed;
}

function mapKpis(row) {
  if (!row || typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency)) {
    throw new BigQueryReadError("IMPACT_ROW_INVALID", "Impact KPI query returned an invalid currency.");
  }
  return {
    lotsScored: count(row.lots_scored, "lots_scored"),
    lotsChanged: count(row.lots_changed, "lots_changed"),
    netSavingMonth: number(row.net_saving_month, "net_saving_month"),
    kgSavedMonth: number(row.kg_saved_month, "kg_saved_month"),
    scrapPctBefore: number(row.scrap_pct_before, "scrap_pct_before"),
    scrapPctAfter: number(row.scrap_pct_after, "scrap_pct_after"),
    scrapCostBefore: number(row.scrap_cost_before, "scrap_cost_before"),
    scrapCostAfter: number(row.scrap_cost_after, "scrap_cost_after"),
    currency: row.currency,
  };
}

function mapMonthly(row) {
  if (typeof row.month !== "string" || !/^\d{4}-\d{2}$/.test(row.month)) {
    throw new BigQueryReadError("IMPACT_ROW_INVALID", "Impact monthly query returned an invalid month.");
  }
  return {
    month: row.month,
    lots: count(row.lots, "monthly lots"),
    scrapCost: number(row.scrap_cost, "monthly scrap_cost"),
    scrapKg: number(row.scrap_kg, "monthly scrap_kg"),
    avgScrapPct: number(row.avg_scrap_pct, "monthly avg_scrap_pct"),
    series: "simulated",
  };
}

function mapSeasonal(row) {
  if (!SEASONS.has(row.season)) {
    throw new BigQueryReadError("IMPACT_ROW_INVALID", "Impact seasonal query returned an invalid season.");
  }
  return {
    season: row.season,
    warp: number(row.warp, "seasonal warp"),
    delam: number(row.delam, "seasonal delam"),
    strength: number(row.strength, "seasonal strength"),
    print: number(row.print, "seasonal print"),
    crack: number(row.crack, "seasonal crack"),
  };
}

function mapTopItem(row, index) {
  if (typeof row.item_code !== "string" || !row.item_code ||
      typeof row.main_defect !== "string" || !/^(WARP|DELAM|STRENGTH|PRINT|CRACK)$/.test(row.main_defect)) {
    throw new BigQueryReadError("IMPACT_ROW_INVALID", "Impact top-item query returned an invalid item.");
  }
  return {
    label: `Item ${index + 1}`,
    lots: count(row.lots, "top-item lots"),
    avgScrapPct: number(row.avg_scrap_pct, "top-item avg_scrap_pct"),
    scrapCost12m: number(row.scrap_cost_12m, "top-item scrap_cost_12m"),
    mainDefect: row.main_defect,
  };
}

export function createImpactSummaryService({
  bigquery,
  sql = {},
  now = () => Date.now(),
  cacheMs = 60 * 60 * 1000,
} = {}) {
  if (!bigquery || typeof bigquery.query !== "function") {
    throw new TypeError("A bounded BigQuery read client is required.");
  }
  if (typeof now !== "function" || !Number.isSafeInteger(cacheMs) || cacheMs < 0) {
    throw new TypeError("Impact cache configuration is invalid.");
  }
  const queries = {
    kpis: loadQuery(sql.kpis, "dash_kpis.sql"),
    monthly: loadQuery(sql.monthly, "dash_monthly.sql"),
    seasonal: loadQuery(sql.seasonal, "dash_seasonal.sql"),
    topItems: loadQuery(sql.topItems, "dash_top_items.sql"),
  };
  let cached;

  return async function getImpactSummary({ signal } = {}) {
    if (cached && now() - cached.createdAt < cacheMs) {
      return { ok: true, source: "bigquery-cache", ...structuredClone(cached.value) };
    }
    try {
      const [kpiResult, monthlyResult, seasonalResult, topItemResult] = await Promise.all([
        bigquery.query({ sql: queries.kpis, signal }),
        bigquery.query({ sql: queries.monthly, signal }),
        bigquery.query({ sql: queries.seasonal, signal }),
        bigquery.query({ sql: queries.topItems, signal }),
      ]);
      const [kpiRow, ...extraKpiRows] = decodeRows(kpiResult, KPI_COLUMNS);
      if (!kpiRow || extraKpiRows.length > 0) {
        throw new BigQueryReadError("IMPACT_ROW_INVALID", "Impact KPI query must return exactly one row.");
      }
      const kpis = mapKpis(kpiRow);
      const monthly = decodeRows(monthlyResult, MONTHLY_COLUMNS).map(mapMonthly);
      const seasonal = decodeRows(seasonalResult, SEASONAL_COLUMNS).map(mapSeasonal);
      const topItems = decodeRows(topItemResult, TOP_ITEM_COLUMNS).map(mapTopItem);
      const september = monthly.find((row) => row.month === "2026-09");
      if (!september) {
        throw new BigQueryReadError("IMPACT_ROW_INVALID", "Impact monthly series did not include September 2026.");
      }
      const value = {
        kpis,
        monthly,
        seasonal,
        topItems,
        counterfactual: {
          month: "2026-09",
          scrapCost: kpis.scrapCostBefore - kpis.netSavingMonth,
          currency: kpis.currency,
          label: "September 2026 with agent settings (counterfactual, not observed production)",
        },
      };
      cached = { createdAt: now(), value: structuredClone(value) };
      return { ok: true, source: "bigquery", ...value };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return {
        ok: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Live Impact data is temporarily unavailable; preview values were not substituted.",
        },
      };
    }
  };
}

export { KPI_COLUMNS, MONTHLY_COLUMNS, SEASONAL_COLUMNS, TOP_ITEM_COLUMNS };
