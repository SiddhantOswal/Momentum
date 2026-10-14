import { OrderExtractionInputSchema } from "../schemas.js";
import { BigQueryReadError } from "./bigquery-read-client.js";

function itemLookupSql(projectId) {
  return `SELECT
  item_code, customer_id, box_style, length_mm, width_mm, height_mm, ply,
  flute_profile, top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf,
  ink_colors, ink_coverage_pct
FROM \`${projectId}.prepagent.items\`
WHERE item_code = @itemCode
LIMIT 2`;
}

function itemResolutionSql(projectId) {
  return `SELECT
  item_code, customer_id, box_style, length_mm, width_mm, height_mm, ply,
  flute_profile, top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf,
  ink_colors, ink_coverage_pct
FROM \`${projectId}.prepagent.items\`
WHERE item_code = @itemCode
   OR STARTS_WITH(item_code, CONCAT(@itemCode, '-'))
ORDER BY item_code
LIMIT 21`;
}

const BIGQUERY_VALUE_FIELDS = Object.freeze([
  "item_code", "customer_id", "box_style", "length_mm", "width_mm", "height_mm",
  "ply", "flute_profile", "top_liner_gsm", "flute_gsm", "inner_liner_gsm",
  "liner_bf", "ink_colors", "ink_coverage_pct",
]);

function decodeRows(result) {
  const fields = result?.schema?.fields;
  if (!Array.isArray(fields) || fields.length !== BIGQUERY_VALUE_FIELDS.length ||
      fields.some((field, index) => field.name !== BIGQUERY_VALUE_FIELDS[index])) {
    throw new BigQueryReadError("ITEM_LOOKUP_SCHEMA_MISMATCH", "The item catalog returned an unexpected schema.");
  }

  return (result.rows ?? []).map((row) => {
    if (!Array.isArray(row?.f) || row.f.length !== fields.length) {
      throw new BigQueryReadError("ITEM_LOOKUP_INVALID_ROW", "The item catalog returned an invalid row.");
    }
    return Object.fromEntries(fields.map((field, index) => {
      const value = row.f[index]?.v;
      if (value === null || value === undefined) return [field.name, undefined];
      if (["INT64", "INTEGER", "FLOAT64", "FLOAT", "NUMERIC", "BIGNUMERIC"].includes(field.type)) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
          throw new BigQueryReadError("ITEM_LOOKUP_INVALID_VALUE", "The item catalog returned an invalid numeric value.");
        }
        return [field.name, number];
      }
      return [field.name, value];
    }));
  });
}

function toOrderProfile(item, itemCode, quantity) {
  const directMappings = {
    itemCode: item.item_code,
    customerId: item.customer_id,
    boxStyle: item.box_style,
    lengthMm: item.length_mm,
    widthMm: item.width_mm,
    heightMm: item.height_mm,
    ply: item.ply,
    fluteProfile: item.flute_profile,
    topLinerGsm: item.top_liner_gsm,
    fluteGsm: item.flute_gsm,
    innerLinerGsm: item.inner_liner_gsm,
    linerBf: item.liner_bf,
    inkColors: item.ink_colors,
    inkCoveragePct: item.ink_coverage_pct,
  };
  const candidate = { orderId: undefined, ...directMappings, itemCode, quantity };
  for (const [key, value] of Object.entries(candidate)) {
    if (value === undefined || value === null || value === "") delete candidate[key];
  }
  return OrderExtractionInputSchema.parse(candidate);
}

export function createItemCatalogService({ bigquery, projectId = "prepagent-hack" } = {}) {
  if (!bigquery || typeof bigquery.query !== "function") {
    throw new TypeError("A bounded BigQuery read client is required.");
  }
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }
  const sql = itemLookupSql(projectId);
  const resolutionSql = itemResolutionSql(projectId);

  return Object.freeze({
    async getOrderProfile({ itemCode, quantity, signal } = {}) {
      if (typeof itemCode !== "string" || itemCode.trim().length === 0 ||
          (quantity !== undefined && (!Number.isSafeInteger(quantity) || quantity < 1))) {
        throw new TypeError("A non-empty item code and, if supplied, a positive integer quantity are required.");
      }

      const result = await bigquery.query({
        sql,
        parameters: { itemCode: itemCode.trim() },
        signal,
      });
      const rows = decodeRows(result);
      if (rows.length === 0) return undefined;
      if (rows.length > 1) {
        throw new BigQueryReadError("ITEM_LOOKUP_NOT_UNIQUE", "The item code did not identify a unique catalog record.");
      }
      return toOrderProfile(rows[0], itemCode.trim(), quantity);
    },
    async resolveOrderLine({ itemCode, quantity, selectedItemCode, signal } = {}) {
      if (typeof itemCode !== "string" || itemCode.trim().length === 0 ||
          (quantity !== undefined && (!Number.isSafeInteger(quantity) || quantity < 1)) ||
          (selectedItemCode !== undefined &&
            (typeof selectedItemCode !== "string" || selectedItemCode.trim().length === 0))) {
        throw new TypeError("A non-empty item code and valid optional quantity/selection are required.");
      }

      const normalizedCode = itemCode.trim();
      const result = await bigquery.query({
        sql: resolutionSql,
        parameters: { itemCode: normalizedCode },
        signal,
      });
      const rows = decodeRows(result);
      if (rows.length === 0) return { status: "UNKNOWN_CODE", candidates: [] };
      if (rows.length > 20) {
        throw new BigQueryReadError("ITEM_LOOKUP_TOO_MANY_CANDIDATES", "The item code has too many catalog candidates.");
      }

      const exactRows = rows.filter((row) => row.item_code === normalizedCode);
      if (exactRows.length === 1) {
        return {
          status: "MATCHED",
          candidates: [],
          resolvedItemCode: normalizedCode,
          orderProfile: toOrderProfile(exactRows[0], normalizedCode, quantity),
        };
      }
      if (exactRows.length > 1) {
        return {
          status: "AMBIGUOUS",
          candidates: exactRows.map((row) => row.item_code),
        };
      }

      const candidateCodes = rows.map((row) => row.item_code);
      const selectedCode = selectedItemCode?.trim();
      const selectedRow = selectedCode
        ? rows.find((row) => row.item_code === selectedCode)
        : undefined;
      return {
        status: "AMBIGUOUS",
        candidates: candidateCodes,
        ...(selectedRow === undefined ? {} : {
          resolvedItemCode: selectedCode,
          orderProfile: toOrderProfile(selectedRow, selectedCode, quantity),
        }),
      };
    },
  });
}

export {
  itemLookupSql as buildItemLookupSql,
  itemResolutionSql as buildItemResolutionSql,
};
