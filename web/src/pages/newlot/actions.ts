import { LEVERS } from "../../lib/session";
import {
  call, postJson, ORDER_PROFILE_KEYS,
  type Explanation, type Extraction, type ExtractedLine, type LotRecord, type Outcome, type PlanOutputs, type PlanResult,
  type PlantReading, type RunConditions, type Status, type Weather,
} from "./api";
import { SAMPLES, getLot, getOrderFile, setOrderFile, updateLot, type ConditionKey, type LotState, type SampleId } from "./store";

const MAX_ORDER_BYTES = 10 * 1024 * 1024;

/** Results built on the confirmed order line. Changing the line or its values makes them out of date. */
const PLAN_RESULTS: Partial<LotState> = {
  checks: [false, false, false], orderConfirmed: false, idempotency: undefined, plannedInputs: undefined,
  plan: undefined, partial: undefined, explanation: undefined, stale: undefined, approved: undefined,
};

/** Everything that depends on the order read. A new order or a new file drops all of it. */
const AFTER_ORDER: Partial<LotState> = { ...PLAN_RESULTS, extraction: undefined, lineIndex: undefined, itemCode: "", quantity: "", lotId: undefined };

const lineCode = (line: ExtractedLine) => line.resolvedItemCode ?? line.extractedItemCode ?? "";

export function chooseLine(line: ExtractedLine) {
  updateLot({ ...PLAN_RESULTS, lineIndex: line.lineIndex, itemCode: lineCode(line), quantity: line.quantity === undefined ? "" : String(line.quantity) });
}

/** The review is bound to the order context it was read with, so a change means reading the order again. */
export function changeContext(field: keyof LotState["context"], value: string) {
  updateLot((lot) => ({ ...AFTER_ORDER, file: lot.file, context: { ...lot.context, [field]: value } }));
}

/** An edited item code or quantity needs new confirmations, and any plan made from the old value is out of date. */
export function editOrderValue(field: "itemCode" | "quantity", value: string) {
  updateLot({ ...PLAN_RESULTS, [field]: value });
}

async function fetchSample(id: SampleId): Promise<File | undefined> {
  const sample = SAMPLES.find((entry) => entry.id === id)!;
  try {
    const response = await fetch(`/samples/${sample.file}`);
    if (!response.ok) return undefined;
    return new File([await response.blob()], sample.file, { type: sample.file.endsWith(".pdf") ? "application/pdf" : "image/jpeg" });
  } catch {
    return undefined;
  }
}

export async function chooseSample(id: SampleId): Promise<string | undefined> {
  const file = await fetchSample(id);
  if (!file) return "The sample order is unavailable. Upload a purchase order instead.";
  const sample = SAMPLES.find((entry) => entry.id === id)!;
  setOrderFile(file);
  updateLot({
    ...AFTER_ORDER, file: { name: file.name, size: file.size, sample: id },
    context: "context" in sample ? { ...sample.context } : { orderId: "", paperType: "", paperSupplier: "" },
  });
  return undefined;
}

export function chooseUpload(file: File): string | undefined {
  const name = file.name.toLowerCase();
  const pdf = name.endsWith(".pdf");
  const jpeg = name.endsWith(".jpg") || name.endsWith(".jpeg");
  if (!pdf && !jpeg) return "Choose a PDF or a JPEG image of the order.";
  if (file.size < 1 || file.size > MAX_ORDER_BYTES) return "Choose a file of up to 10 MiB.";
  setOrderFile(file);
  updateLot({ ...AFTER_ORDER, file: { name: file.name, size: file.size } });
  return undefined;
}

/** The file to send. A sample is fetched again when the page was reloaded since it was chosen. */
async function orderFileFor(lot: LotState): Promise<File | undefined> {
  const kept = getOrderFile();
  if (kept && kept.name === lot.file?.name) return kept;
  if (!lot.file?.sample) return undefined;
  const file = await fetchSample(lot.file.sample);
  if (file) setOrderFile(file);
  return file;
}

function contextFields(lot: LotState) {
  return Object.entries(lot.context).filter(([, value]) => value.trim() !== "") as [string, string][];
}

/** POST /orders/extract: Gemini reads the order once and the server matches each line to the catalog. */
export async function readOrder(): Promise<Outcome<Extraction>> {
  const lot = getLot();
  const file = await orderFileFor(lot);
  if (!file) return { ok: false, message: "Choose the order file again. Uploaded files are not kept after a reload." };
  const body = new FormData();
  body.append("file", file);
  for (const [field, value] of contextFields(lot)) body.append(field, value.trim());
  const result = await call<Extraction>("/orders/extract", { method: "POST", body });
  if (!result.ok) return result;
  updateLot({ ...AFTER_ORDER, extraction: result.data });
  if (result.data.lines.length === 1) chooseLine(result.data.lines[0]);
  return result;
}

/** GET /conditions/weather: the public weather record fills humidity and temperature that the operator has not typed. */
export async function loadWeather(overwrite = false): Promise<Outcome<Weather>> {
  const result = await call<Weather>("/conditions/weather");
  if (!result.ok) return result;
  const { ambientRhPct, ambientTempC, observedAt, location } = result.data;
  updateLot((lot) => {
    const conditions = { ...lot.conditions };
    const sources = { ...lot.sources };
    for (const [key, value] of [["ambientRhPct", ambientRhPct], ["ambientTempC", ambientTempC]] as const) {
      if (!overwrite && lot.conditions[key] !== "" && lot.sources[key]?.kind !== "weather") continue;
      conditions[key] = String(value);
      sources[key] = { kind: "weather", observedAt, location };
    }
    return { conditions, sources };
  });
  return result;
}

/** GET /conditions/current: the last stored plant reading in the dataset for the shift. */
export async function loadPlantReading(shift: string): Promise<Outcome<PlantReading>> {
  const result = await call<PlantReading>(`/conditions/current?shift=${shift === "NIGHT" ? "NIGHT" : "DAY"}`);
  if (!result.ok) return result;
  const { data, sensorSource, provenance } = result.data;
  const source = { kind: "dataset" as const, simulated: sensorSource === "simulated", recordedAt: provenance?.timestamp ?? data.runDate };
  updateLot((lot) => ({
    conditions: { ...lot.conditions, ambientRhPct: String(data.ambientRhPct), ambientTempC: String(data.ambientTempC), paperMoisturePct: String(data.paperMoisturePct) },
    sources: { ...lot.sources, ambientRhPct: source, ambientTempC: source, paperMoisturePct: source },
  }));
  return result;
}

function planBody(lot: LotState, file: File) {
  const line = lot.extraction!.lines.find((entry) => entry.lineIndex === lot.lineIndex)!;
  const body = new FormData();
  body.append("file", file);
  for (const [field, value] of contextFields(lot)) body.append(field, value.trim());
  if (lot.lotId) body.append("lotId", lot.lotId);
  body.append("confirmedItemCode", lot.itemCode.trim());
  body.append("confirmedQuantity", lot.quantity.trim());
  body.append("confirmedLineIndex", String(line.lineIndex + 1));
  body.append("reviewId", lot.extraction!.reviewId);
  body.append("reviewFingerprint", lot.extraction!.reviewFingerprint);
  body.append("confirmedSourceLine", "true");
  for (const [field, value] of Object.entries(lot.conditions)) body.append(field, value.trim());
  body.append("conditionsConfirmed", "true");
  for (const lever of LEVERS) body.append(lever.key, lot.levers[lever.key].trim());
  return body;
}

/**
 * POST /jobs, the command Arc's plan_lot tool also calls: it applies the condition guard,
 * predicts, searches settings, explains and stores the draft as a new revision of the lot.
 * The same inputs reuse the idempotency key, so a retry continues the same revision.
 */
export async function planLot(): Promise<Outcome<PlanResult>> {
  const lot = getLot();
  if (!lot.extraction || lot.lineIndex === undefined) return { ok: false, message: "Read and confirm the order first." };
  const file = await orderFileFor(lot);
  if (!file) return { ok: false, message: "Choose the order file again on the Order step. Uploaded files are not kept after a reload." };
  const fingerprint = JSON.stringify([lot.file, lot.context, lot.extraction.reviewFingerprint, lot.lineIndex, lot.itemCode, lot.quantity, lot.conditions, lot.levers, lot.lotId]);
  const key = lot.idempotency?.fingerprint === fingerprint ? lot.idempotency.key : crypto.randomUUID();
  updateLot({ idempotency: { fingerprint, key } });
  const result = await call<PlanResult>("/jobs", { method: "POST", body: planBody(lot, file), headers: { "Idempotency-Key": key } });
  const inputs = { conditions: { ...lot.conditions }, levers: { ...lot.levers } };
  if (result.ok) {
    updateLot({
      plan: result.data, lotId: result.data.revision?.lotId ?? lot.lotId, plannedInputs: inputs,
      partial: undefined, explanation: undefined, stale: undefined, approved: undefined,
    });
    return result;
  }
  const outputs = result.body as PlanOutputs | undefined;
  if (outputs?.blockedAt === "explainRisk" && outputs.prediction && outputs.optimization) {
    updateLot({ partial: { outputs, message: result.message }, plan: undefined, plannedInputs: inputs, explanation: undefined, stale: undefined, approved: undefined });
  }
  return result;
}

const CONDITION_NUMBERS: ConditionKey[] = ["ambientRhPct", "ambientTempC", "paperMoisturePct"];

/**
 * PUT /lots/:lotId/conditions, the command behind Arc's set_conditions tool. Once a draft
 * exists, an edited condition is recorded on the lot, and the server replaces the draft if the
 * value differs from the one it was planned with.
 */
export async function recordConditionEdit(field: ConditionKey): Promise<Outcome<unknown> | undefined> {
  const lot = getLot();
  const revision = lot.plan?.revision;
  if (!lot.lotId || !revision || revision.status !== "CURRENT" || lot.approved) return undefined;
  const raw = lot.conditions[field].trim();
  if (raw === "" || raw === lot.plannedInputs?.conditions[field]) return undefined;
  const value = CONDITION_NUMBERS.includes(field) ? Number(raw) : raw;
  if (typeof value === "number" && !Number.isFinite(value)) return undefined;
  const result = await call<{ superseded: null | { jobId: string; number: number } }>(`/lots/${encodeURIComponent(lot.lotId)}/conditions`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conditions: [{ field, value, source: "typed" }] }),
  });
  if (result.ok && result.data.superseded) {
    const { jobId, number } = result.data.superseded;
    updateLot({ stale: { jobId, number, message: "An input changed after this draft was prepared, so it is replaced and read only." } });
  }
  return result;
}

const pick = <T extends object>(source: T, keys: (keyof T)[]) =>
  Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]])) as T;

/** POST /risk/explanation over the numbers the plan already returned. Its `source` says whether Gemini wrote the text. */
export async function explain(outputs: PlanOutputs): Promise<Outcome<Explanation>> {
  if (!outputs.orderProfile || !outputs.conditions || !outputs.prediction || !outputs.optimization) {
    return { ok: false, message: "The plan did not return the numbers an explanation needs." };
  }
  const result = await postJson<Explanation>("/risk/explanation", {
    order: pick(outputs.orderProfile, ORDER_PROFILE_KEYS),
    conditions: pick(outputs.conditions as RunConditions, ["runDate", "shift", "ambientRhPct", "ambientTempC", "paperMoisturePct"]),
    prediction: outputs.prediction,
    optimization: outputs.optimization,
    evidence: outputs.evidence ?? [],
  });
  if (result.ok) updateLot({ explanation: result.data });
  return result;
}

export const readJob = (jobId: string) =>
  call<Pick<PlanResult, "jobSheet" | "revision">>(`/jobs/${encodeURIComponent(jobId)}`);

export const readLotRecord = (lotId: string) => call<LotRecord>(`/lots/${encodeURIComponent(lotId)}`);

export const readStatus = () => call<Status>("/api/status");

export const cardPdfHref = (jobId: string) => `/jobs/${encodeURIComponent(jobId)}/card.pdf?lang=en&currency=INR`;
