import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isApprovedSyntheticPurchaseOrder } from "../src/synthetic-po-allowlist.js";

const fixtureNames = [
  "PO1_ClientA_single_B1047.pdf",
  "PO2_ClientA_multiline.pdf",
  "PO3_ClientP_electronics_with_fitment.pdf",
  "PO4_ClientQ_ambiguous_set.pdf",
  "PO5_ClientB_scanned.jpg",
];

test("only the exact owner-approved synthetic PO fixtures are allowlisted", async () => {
  for (const name of fixtureNames) {
    const bytes = new Uint8Array(await readFile(new URL(`./fixtures/synthetic_POs/${name}`, import.meta.url)));
    assert.equal(isApprovedSyntheticPurchaseOrder(bytes), true, name);
    assert.equal(isApprovedSyntheticPurchaseOrder(new Uint8Array([...bytes, 0])), false, `${name} modified`);
  }
  assert.equal(isApprovedSyntheticPurchaseOrder(new Uint8Array()), false);
  assert.equal(isApprovedSyntheticPurchaseOrder("not bytes"), false);
});
