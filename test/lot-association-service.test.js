import assert from "node:assert/strict";
import test from "node:test";
import { createLotAssociationService } from "../src/google-cloud/lot-association-service.js";

const fields = [{ name: "lot_id", type: "STRING" }, { name: "order_id", type: "STRING" }];

test("lot association uses one bounded parameterized read and returns the lot's order", async () => {
  let query;
  const getLotOrderId = createLotAssociationService({
    projectId: "prepagent-hack",
    bigquery: { query: async (request) => {
      query = request;
      return { schema: { fields }, rows: [{ f: [{ v: "LOT-SYNTHETIC-1" }, { v: "PO-SYNTHETIC-1" }] }] };
    } },
  });

  assert.equal(await getLotOrderId({ lotId: "LOT-SYNTHETIC-1" }), "PO-SYNTHETIC-1");
  assert.equal(query.sql, "SELECT lot_id, order_id FROM `prepagent-hack.prepagent.lots` WHERE lot_id = @lotId LIMIT 2");
  assert.deepEqual(query.parameters, { lotId: "LOT-SYNTHETIC-1" });
});

test("lot association returns undefined for no match and rejects ambiguous or malformed rows", async () => {
  const forRows = (rows) => createLotAssociationService({
    bigquery: { query: async () => ({ schema: { fields }, rows }) },
  });
  assert.equal(await forRows([])({ lotId: "LOT-SYNTHETIC-1" }), undefined);
  await assert.rejects(forRows([
    { f: [{ v: "LOT-SYNTHETIC-1" }, { v: "PO-A" }] },
    { f: [{ v: "LOT-SYNTHETIC-1" }, { v: "PO-B" }] },
  ])({ lotId: "LOT-SYNTHETIC-1" }), { code: "LOT_ASSOCIATION_INVALID" });
  await assert.rejects(forRows([{ f: [{ v: "LOT-OTHER" }, { v: "PO-A" }] }])({ lotId: "LOT-SYNTHETIC-1" }), {
    code: "LOT_ASSOCIATION_INVALID",
  });
});
