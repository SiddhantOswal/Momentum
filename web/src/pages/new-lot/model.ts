import { LEVERS, type Extraction, type ExtractedLine, type JobResult, type Levers, type LeverKey } from "../../lib/session";

export const STEPS = ["Order", "Conditions", "Settings and risk", "Review and approve"] as const;

// The five approved synthetic purchase orders (src/synthetic-po-allowlist.js). Only PO1 has a known
// order context; the others leave paper type and supplier to the operator.
export type Sample = { id: string; label: string; file: string; mime: string; context?: { orderId: string; paperType: string; paperSupplier: string } };
export const SAMPLES: readonly Sample[] = [
  { id: "PO1", label: "PO1 Single line", file: "PO1_ClientA_single_B1047.pdf", mime: "application/pdf",
    context: { orderId: "TEST-CLA/PO/2026/1047", paperType: "RECYCLED", paperSupplier: "SUP-D" } },
  { id: "PO2", label: "PO2 Multi-line", file: "PO2_ClientA_multiline.pdf", mime: "application/pdf" },
  { id: "PO3", label: "PO3 Fitment", file: "PO3_ClientP_electronics_with_fitment.pdf", mime: "application/pdf" },
  { id: "PO4", label: "PO4 Review", file: "PO4_ClientQ_ambiguous_set.pdf", mime: "application/pdf" },
  { id: "PO5", label: "PO5 Scan", file: "PO5_ClientB_scanned.jpg", mime: "image/jpeg" },
];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TYPES = ["application/pdf", "image/jpeg"];

export const PAPER_TYPES = ["VIRGIN", "RECYCLED", "MIXED"] as const;

export type OrderContext = { orderId: string; paperType: string; paperSupplier: string };
export const EMPTY_CONTEXT: OrderContext = { orderId: "", paperType: "", paperSupplier: "" };

export type ConditionKey = "ambientRhPct" | "paperMoisturePct" | "ambientTempC" | "runDate" | "shift";
export type ConditionValues = Record<ConditionKey, string>;
export const EMPTY_CONDITIONS: ConditionValues = { ambientRhPct: "", paperMoisturePct: "", ambientTempC: "", runDate: "", shift: "" };
export const EMPTY_LEVERS = Object.fromEntries(LEVERS.map((lever) => [lever.key, ""])) as Levers;

export const CONDITION_FIELDS: { key: ConditionKey; label: string; unit?: string; kind: "number" | "date" | "shift"; min?: number; max?: number }[] = [
  { key: "ambientRhPct", label: "Humidity", unit: "%", kind: "number", min: 0, max: 100 },
  { key: "paperMoisturePct", label: "Paper moisture", unit: "%", kind: "number", min: 0, max: 20 },
  { key: "ambientTempC", label: "Ambient temperature", unit: "°C", kind: "number" },
  { key: "runDate", label: "Run date", kind: "date" },
  { key: "shift", label: "Shift", kind: "shift" },
];

export const SHIFTS = [{ value: "DAY", label: "Day" }, { value: "NIGHT", label: "Night" }];
export const LEVEL_LABEL: Record<string, string> = { LOW: "LOW", MED: "MEDIUM", HIGH: "HIGH" };
export const leverText = (key: string, value: string | number) => key === "gumApplication" || key === "pastingPressure" ? (LEVEL_LABEL[String(value)] ?? String(value)) : String(value);

const finite = (text: string) => text.trim() !== "" && Number.isFinite(Number(text));

export function conditionDone(key: ConditionKey, values: ConditionValues): boolean {
  const field = CONDITION_FIELDS.find((entry) => entry.key === key)!;
  const text = values[key];
  if (field.kind === "date") return /^\d{4}-\d{2}-\d{2}$/.test(text);
  if (field.kind === "shift") return text === "DAY" || text === "NIGHT";
  if (!finite(text)) return false;
  const number = Number(text);
  return (field.min === undefined || number >= field.min) && (field.max === undefined || number <= field.max);
}

export function leverDone(key: LeverKey, levers: Levers): boolean {
  const lever = LEVERS.find((entry) => entry.key === key)!;
  const text = String(levers[key]);
  if ("options" in lever) return (lever.options as readonly string[]).includes(text);
  if (!finite(text)) return false;
  return Number(text) >= lever.min && Number(text) <= lever.max;
}

export function fieldProgress(conditions: ConditionValues, levers: Levers) {
  const total = CONDITION_FIELDS.length + LEVERS.length;
  const done = CONDITION_FIELDS.filter((field) => conditionDone(field.key, conditions)).length + LEVERS.filter((lever) => leverDone(lever.key, levers)).length;
  return { done, total, left: total - done };
}

export type LineChoice = { code: string; quantity: string };
export function lineChoice(line: ExtractedLine | undefined): LineChoice {
  return { code: line?.extractedItemCode ?? "", quantity: line?.quantity === undefined ? "" : String(line.quantity) };
}

/** Why the selected line cannot be prepared yet, or undefined when it can. */
export function lineProblem(line: ExtractedLine | undefined, choice: LineChoice): string | undefined {
  if (!line) return "Select the order line to prepare.";
  if (line.validationIssues?.length) return "This line looks malformed. Check it against the order.";
  if (line.candidates?.length && !line.candidates.includes(choice.code)) return "This code matches more than one catalog item. Pick the right one.";
  if ((line.status === "UNKNOWN_CODE" || line.catalogStatus === "UNKNOWN_CODE") && choice.code === line.extractedItemCode) return "This code is not in the plant's catalog. Enter the correct code.";
  if (!/^\d+$/.test(choice.quantity.trim()) || Number(choice.quantity) < 1) return "Enter the quantity shown on the order.";
  if (choice.code.trim() === "") return "Enter the item code.";
  return undefined;
}

export type PlanInput = {
  file: File; context: OrderContext; extraction: Extraction; lineIndex: number; choice: LineChoice;
  conditions: ConditionValues; levers: Levers; lotId?: string;
};

/** The multipart body POST /jobs expects. Every confirmation flag is sent only after the operator pressed the matching button. */
export function planBody(input: PlanInput): FormData {
  const body = new FormData();
  body.append("file", input.file);
  body.append("orderId", input.context.orderId);
  body.append("paperType", input.context.paperType);
  body.append("paperSupplier", input.context.paperSupplier);
  body.append("confirmedItemCode", input.choice.code.trim());
  body.append("confirmedQuantity", input.choice.quantity.trim());
  body.append("confirmedLineIndex", String(input.lineIndex + 1));
  body.append("reviewId", input.extraction.reviewId);
  body.append("reviewFingerprint", input.extraction.reviewFingerprint);
  body.append("confirmedSourceLine", "true");
  for (const field of CONDITION_FIELDS) body.append(field.key, input.conditions[field.key].trim());
  body.append("conditionsConfirmed", "true");
  for (const lever of LEVERS) body.append(lever.key, String(input.levers[lever.key]));
  if (input.lotId) body.append("lotId", input.lotId);
  return body;
}

/** One key per distinct request, so a retry of the same plan is answered once and a changed plan is not. */
export function planFingerprint(input: PlanInput): string {
  return JSON.stringify([input.file.name, input.file.size, input.context, input.choice, input.extraction.reviewFingerprint, input.conditions, input.levers, input.lotId ?? null]);
}

export function conditionPatch(conditions: ConditionValues, touched: ReadonlySet<ConditionKey>) {
  return CONDITION_FIELDS.filter((field) => conditionDone(field.key, conditions)).map((field) => ({
    field: field.key,
    value: field.kind === "number" ? Number(conditions[field.key]) : conditions[field.key],
    source: touched.has(field.key) ? "confirmed" : "typed",
  }));
}

export type LotRead = { lot: { lotId: string; currentRevision?: number }; revision?: { number: number; status: string; fingerprint: string | null; supersededReason?: { field?: string; source?: string; byRole?: string } | string } };
export const isReplaced = (read: LotRead | undefined, result: JobResult) =>
  read?.revision?.status === "SUPERSEDED" || (read?.lot.currentRevision !== undefined && result.revision !== undefined && read.lot.currentRevision > result.revision.number);

export const changeCount = (result: JobResult) => result.jobSheet.changes.length;
export const unchangedCount = (result: JobResult) => LEVERS.length - changeCount(result);
export const hasExplanation = (result: JobResult) => typeof result.jobSheet.explanation === "string" && result.jobSheet.explanation.trim() !== "";
export const revisionLabel = (result: JobResult) => result.revision ? `Rev ${result.revision.number}` : "Rev 1";

/** Fixed decimals, so 83 kg reads as 83.0 kg like the other figures on the card. */
export const fixed = (value: number, digits = 1) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
