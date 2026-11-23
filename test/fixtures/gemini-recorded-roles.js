// Fake Vertex responses for the extraction, explanation and photo services.
// None of this text came from a live model call; it exists so the request
// body and the parsed fields can be compared before and after a settings change.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createPdfOrderExtractionService } from "../../src/google-cloud/order-extraction-service.js";
import { createRiskExplanationService } from "../../src/google-cloud/risk-evidence-service.js";
import { createDefectDiagnosisService } from "../../src/google-cloud/defect-diagnosis-service.js";
import { createApprovedPhotoService } from "../../src/google-cloud/approved-photo-service.js";

const sql = readFileSync(new URL("../../sql/explain.sql", import.meta.url), "utf8");
const jpeg = new Uint8Array(readFileSync(new URL("./synthetic_POs/PO5_ClientB_scanned.jpg", import.meta.url)));

export const recordedModelText = Object.freeze({
  extraction: JSON.stringify({
    poNumber: "PO-7781", buyer: "Synthetic Buyer", deliveryDate: "05-12-2026",
    lines: [{ itemCode: "PKBX0041", quantity: 1300, sourcePage: 1 }],
  }),
  explanation: "Humidity at 86% is a leading risk driver. WARP is predicted at 3.42%, compared with a typical 1.35%. The positive 0.9-point attribution indicates elevated risk under these conditions.",
  photoDiagnosis: JSON.stringify({
    isCorrugatedBoard: true, label: "DELAM", severity: "MEDIUM", confidence: 0.834,
    visibleSigns: ["Liner lifting at the edge"],
  }),
  photoClassification: JSON.stringify({ label: "CRACK" }),
});

export function vertexPayload(text) {
  return {
    candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40, totalTokenCount: 160 },
  };
}

const order = {
  orderId: "PO-1", itemCode: "PKBX0041", customerId: "C-1", boxStyle: "RSC",
  lengthMm: 400, widthMm: 300, heightMm: 250, ply: 5, fluteProfile: "BC",
  topLinerGsm: 180, fluteGsm: 150, innerLinerGsm: 180, linerBf: 24,
  paperType: "RECYCLED", paperSupplier: "SUP-D", inkColors: 2, inkCoveragePct: 15, quantity: 1300,
};
const conditions = { runDate: "2026-10-12", shift: "DAY", ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8 };
const planned = {
  sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32,
  pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60,
};
const prediction = {
  ratesPct: { WARP: 3.423, DELAM: 2.98, STRENGTH: 1.167, PRINT: 1.828, CRACK: 0.778 },
  totalScrapPct: 10.18, totalScrapKg: 100.4, scrapCost: 5351, currency: "INR", primaryDefect: "WARP",
};
const optimization = {
  baseline: { levers: planned, risk: prediction },
  best: {
    levers: { ...planned, rollTempC: 170, gumApplication: "MED", gumViscositySec: 35 },
    risk: {
      ratesPct: { WARP: 3.42, DELAM: 2, STRENGTH: 1, PRINT: 1, CRACK: 0.5 },
      totalScrapPct: 7.92, totalScrapKg: 80, scrapCost: 4000, currency: "INR", primaryDefect: "WARP",
    },
  },
  changes: [],
  savings: { kg: 20.4, inr: 1351 },
};
const evidence = [{
  lotId: "LOT-1", orderId: "PO-HIST-1", runDate: "2026-09-20", itemCode: "PKBX0041", description: "B1047",
  shift: "DAY", ambientRhPct: 86, paperType: "RECYCLED", paperSupplier: "SUP-D", levers: planned,
  totalScrapPct: 8.85, totalScrapKg: 85.2, scrapCost: 3834, currency: "INR", primaryDefect: "WARP",
  distance: 0.12, operatorNote: "Operator note",
}];
const explanationColumns = ["defect", "predicted_pct", "typical_pct", "driver_rank", "driver", "attribution_pts"];
const explanationRows = [
  ["WARP", "3.42", "1.35", "1", "ambient_rh_pct", "0.9"],
  ["DELAM", "2", "1.1", "1", "gum_application", "0.4"],
  ["STRENGTH", "1", "0.7", "1", "pasting_pressure", "0.2"],
  ["PRINT", "1", "0.6", "1", "ink_colors", "0.1"],
  ["CRACK", "0.5", "0.3", "1", "drying_hours", "0.2"],
];
const bigquery = {
  query: async () => ({
    schema: { fields: explanationColumns.map((name) => ({ name })) },
    rows: explanationRows.map((row) => ({ f: row.map((value) => ({ v: value })) })),
  }),
};

const photoHash = createHash("sha256").update(jpeg).digest("hex");
const inventory = {
  bucket: "prepagent-hack-data",
  photos: Array.from({ length: 10 }, (_, i) => ({
    id: `photo-${String(i + 1).padStart(2, "0")}`,
    name: `photos/photos/crack/crack_${String(i + 1).padStart(3, "0")}.jpg`,
    generation: "1", size: jpeg.length, sha256: photoHash,
  })),
};
const photoStorage = {
  getMetadata: async ({ name }) => ({ name, generation: "1", size: jpeg.length, contentType: "image/jpeg" }),
  download: async ({ name }) => ({ name, contentType: "image/jpeg", bytes: jpeg }),
};

/** Runs one service end to end with the given Gemini client and returns its result. */
export async function runRecordedRole(role, gemini) {
  const fixedNow = () => new Date("2026-11-21T10:00:00Z");
  if (role === "extraction") {
    const service = createPdfOrderExtractionService({
      storage: {
        createObjectName: () => "orders/recorded.pdf",
        upload: async () => ({ gcsUri: "gs://prepagent-hack-data/orders/recorded.pdf" }),
        delete: async () => {},
      },
      gemini,
      itemCatalog: {
        getOrderProfile: async ({ itemCode, quantity }) => ({
          itemCode, quantity, customerId: "CUST-1", boxStyle: "RSC", lengthMm: 1392,
          widthMm: 420, heightMm: 0, ply: 5, fluteProfile: "BC", topLinerGsm: 125,
          fluteGsm: 115, innerLinerGsm: 125, linerBf: 18, inkColors: 0, inkCoveragePct: 0,
        }),
      },
    });
    return service({
      file: { size: 5, name: "recorded.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
    });
  }
  if (role === "explanation") {
    const service = createRiskExplanationService({ bigquery, gemini, sql });
    return service({ order, conditions, prediction, optimization, evidence });
  }
  if (role === "photoDiagnosis") {
    const service = createDefectDiagnosisService({
      storage: { upload: async () => {} }, gemini, bucket: "prepagent-hack-data", model: "gemini-3.5-flash",
      now: fixedNow, id: () => "recorded",
    });
    return service.diagnose({ bytes: jpeg });
  }
  if (role === "photoClassification") {
    const service = createApprovedPhotoService({ storage: photoStorage, gemini, inventory, model: "gemini-3.5-flash", now: fixedNow });
    return service.classify({ photoId: "photo-01" });
  }
  throw new TypeError(`Unknown recorded role ${role}`);
}

export const RECORDED_ROLES = Object.freeze(["extraction", "explanation", "photoDiagnosis", "photoClassification"]);
