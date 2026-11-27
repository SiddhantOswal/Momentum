import test from "node:test";
import assert from "node:assert/strict";
import { createDefectDiagnosisService, identifyPhotoMimeType } from "../src/google-cloud/defect-diagnosis-service.js";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 2, 3]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1]);
const make = (answer, uploads = []) => createDefectDiagnosisService({
  bucket: "prepagent-hack-data", model: "gemini-test",
  now: () => new Date("2026-11-21T10:00:00Z"), id: () => "abc",
  storage: { upload: async (o) => { uploads.push(o); } },
  gemini: { generateJson: async (req) => { uploads.push({ gemini: req.fileUri }); return typeof answer === "function" ? answer() : answer; } },
});

test("recognises photo types by their bytes only", () => {
  assert.equal(identifyPhotoMimeType(jpeg), "image/jpeg");
  assert.equal(identifyPhotoMimeType(png), "image/png");
  assert.equal(identifyPhotoMimeType(new TextEncoder().encode("%PDF-1.7 not a photo")), undefined);
});

test("stores the photo, asks Gemini, and returns a structured diagnosis", async () => {
  const uploads = [];
  const result = await make({ isCorrugatedBoard: true, label: "DELAM", severity: "MEDIUM", confidence: 0.834, visibleSigns: ["Liner lifting at the edge"] }, uploads).diagnose({ bytes: jpeg });
  assert.equal(result.ok, true);
  assert.equal(result.diagnosis.label, "DELAM");
  assert.equal(result.diagnosis.confidence, 0.83);
  assert.equal(uploads[0].name, "defects/2026-11-21/abc.jpg");
  assert.equal(uploads[1].gemini, "gs://prepagent-hack-data/defects/2026-11-21/abc.jpg");
});

test("a photo that is not corrugated board gets a plain retake message", async () => {
  const result = await make({ isCorrugatedBoard: false, label: "NONE", severity: "LOW", confidence: 0.9, visibleSigns: [] }).diagnose({ bytes: png });
  assert.equal(result.ok, true);
  assert.equal(result.recognised, false);
  assert.match(result.message, /closer photo/);
});

test("rejects non-photos, empty and oversized files, and malformed model output", async () => {
  const service = make({ label: "MAYBE" });
  assert.equal((await service.diagnose({ bytes: new TextEncoder().encode("%PDF-1.7 something long") })).error.code, "VALIDATION_ERROR");
  assert.equal((await service.diagnose({ bytes: new Uint8Array() })).error.code, "VALIDATION_ERROR");
  assert.equal((await service.diagnose({ bytes: new Uint8Array(9 * 1024 * 1024) })).error.code, "VALIDATION_ERROR");
  assert.equal((await service.diagnose({ bytes: jpeg })).error.code, "SERVICE_UNAVAILABLE");
});
