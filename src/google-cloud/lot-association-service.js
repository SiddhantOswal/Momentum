import { BigQueryReadError } from "./bigquery-read-client.js";

export function createLotAssociationService({ bigquery, projectId = "prepagent-hack" } = {}) {
  if (!bigquery || typeof bigquery.query !== "function") {
    throw new TypeError("A bounded BigQuery read client is required.");
  }
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }

  return async function getLotOrderId({ lotId, signal } = {}) {
    if (typeof lotId !== "string" || lotId.trim().length === 0) {
      throw new TypeError("A lot ID is required.");
    }
    const result = await bigquery.query({
      sql: `SELECT lot_id, order_id FROM \`${projectId}.prepagent.lots\` WHERE lot_id = @lotId LIMIT 2`,
      parameters: { lotId },
      signal,
    });
    if (!Array.isArray(result?.rows) || result.rows.length > 1) {
      throw new BigQueryReadError("LOT_ASSOCIATION_INVALID", "The lot lookup returned an ambiguous result.");
    }
    if (result.rows.length === 0) return undefined;

    const fields = result.schema?.fields;
    const row = result.rows[0]?.f;
    if (!Array.isArray(fields) || !Array.isArray(row) || fields.length !== row.length) {
      throw new BigQueryReadError("LOT_ASSOCIATION_INVALID", "The lot lookup returned an invalid row.");
    }
    const lotIndex = fields.findIndex((field) => field.name === "lot_id");
    const orderIndex = fields.findIndex((field) => field.name === "order_id");
    const returnedLotId = lotIndex >= 0 ? row[lotIndex]?.v : undefined;
    const orderId = orderIndex >= 0 ? row[orderIndex]?.v : undefined;
    if (returnedLotId !== lotId || typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new BigQueryReadError("LOT_ASSOCIATION_INVALID", "The lot lookup returned an invalid association.");
    }
    return orderId;
  };
}
