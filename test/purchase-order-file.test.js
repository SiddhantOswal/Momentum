import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  identifyPurchaseOrderMimeType,
  MAX_DECODED_JPEG_PIXELS,
} from "../src/purchase-order-file.js";

function jpeg(width, height) {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

test("JPEG upload validation accepts bounded dimensions and the approved scan fixture", () => {
  assert.equal(identifyPurchaseOrderMimeType(
    { name: "scan.jpg", type: "image/jpeg" }, jpeg(5000, 5000),
  ), "image/jpeg");
  const approvedScan = readFileSync(new URL("./fixtures/synthetic_POs/PO5_ClientB_scanned.jpg", import.meta.url));
  assert.equal(identifyPurchaseOrderMimeType(
    { name: "approved.jpg", type: "image/jpeg" }, new Uint8Array(approvedScan),
  ), "image/jpeg");
});

test("JPEG upload validation rejects decoded-pixel bombs and malformed dimensions", () => {
  assert.ok(MAX_DECODED_JPEG_PIXELS > 0);
  assert.equal(identifyPurchaseOrderMimeType(
    { name: "bomb.jpg", type: "image/jpeg" }, jpeg(65535, 65535),
  ), undefined);
  assert.equal(identifyPurchaseOrderMimeType(
    { name: "truncated.jpg", type: "image/jpeg" }, Uint8Array.from([0xff, 0xd8, 0xff, 0xc0]),
  ), undefined);
  assert.equal(identifyPurchaseOrderMimeType(
    { name: "missing-frame.jpg", type: "image/jpeg" }, Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
  ), undefined);
});

test("PDF upload validation requires a PDF signature and rejects unsupported file types", () => {
  assert.equal(identifyPurchaseOrderMimeType(
    { name: "order.pdf", type: "application/pdf" }, Buffer.from("%PDF-1.7"),
  ), "application/pdf");
  assert.equal(identifyPurchaseOrderMimeType(
    { name: "order.pdf", type: "application/pdf" }, Buffer.from("not a PDF"),
  ), undefined);
  assert.equal(identifyPurchaseOrderMimeType(
    { name: "order.png", type: "image/png" }, Buffer.from("\x89PNG"),
  ), undefined);
});
