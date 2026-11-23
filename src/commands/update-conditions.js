import { z } from "zod";
import { isWithinRange } from "../condition-guard.js";
import { RunConditionsSchema } from "../schemas.js";
import { checkLotAccess, lotFailure, lotStoreFailure } from "./lot-access.js";
import { validateWith } from "./validation.js";

const FIELDS = ["runDate", "shift", "ambientRhPct", "ambientTempC", "paperMoisturePct"];
const UNITS = { runDate: "date", shift: "shift", ambientRhPct: "% RH", ambientTempC: "°C", paperMoisturePct: "%" };
// Labels are set here, from the source the server accepts; the client never supplies one.
const SOURCES = {
  typed: { provenance: "operator_entry", label: "Entered by operator", confirmed: false },
  confirmed: { provenance: "operator_entry", label: "Confirmed by operator", confirmed: true },
  example: { provenance: "synthetic_example", label: "Example value", confirmed: false },
};
const BY_ROLE = "Supervisor session";

const ConditionsRequestSchema = z.object({
  conditions: z.array(z.object({
    field: z.enum(FIELDS),
    value: z.union([z.number().finite(), z.string().min(1).max(16)]),
    // Weather and dataset sources arrive with ARC-M8; until then a client cannot claim them.
    source: z.enum(["typed", "confirmed", "example"]),
  }).strict()).min(1).max(FIELDS.length),
}).strict().superRefine(({ conditions }, ctx) => {
  const seen = new Set();
  conditions.forEach((entry, index) => {
    if (seen.has(entry.field)) {
      ctx.addIssue({ code: "custom", path: ["conditions", index, "field"], message: "Each field may appear once." });
    }
    seen.add(entry.field);
    const parsed = RunConditionsSchema.shape[entry.field].safeParse(entry.value);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", path: ["conditions", index, "value"], message: `Enter a valid ${entry.field}.` });
    } else if (["ambientRhPct", "ambientTempC", "paperMoisturePct"].includes(entry.field) &&
               !isWithinRange(entry.field, entry.value)) {
      ctx.addIssue({ code: "custom", path: ["conditions", index, "value"], message: "The value is outside the plant's recorded range." });
    }
    if (entry.source === "example" && entry.field !== "paperMoisturePct") {
      ctx.addIssue({ code: "custom", path: ["conditions", index, "source"], message: "Only paper moisture has an example value." });
    }
  });
});

function provenanced({ field, value, source }) {
  const { provenance, label, confirmed } = SOURCES[source];
  return {
    field, value, unit: UNITS[field], provenance, sourceDetail: source, label, confirmed,
    ...(provenance === "operator_entry" ? { enteredByRole: BY_ROLE } : {}),
  };
}

/**
 * Saves the conditions typed or confirmed for a lot. If a planned draft was
 * made with different values, the store supersedes it in the same commit, so
 * the old draft can no longer be approved (ADR-0003).
 */
export async function updateLotConditions({ lotId, body } = {}, { principal, signal, lotRevisions }) {
  const access = checkLotAccess(lotId, { principal, lotRevisions });
  if (!access.ok) return access;
  const request = validateWith(ConditionsRequestSchema, body, "Conditions failed validation.");
  if (!request.ok) return request.failure;
  let saved;
  try {
    saved = await access.store.saveConditions({
      lotId: access.lotId,
      ownerSessionId: principal.sessionId,
      conditions: request.data.conditions.map(provenanced),
      byRole: BY_ROLE,
      signal,
    });
  } catch (error) {
    return lotStoreFailure(error);
  }
  if (!saved.ok) {
    return saved.code === "APPROVAL_IN_PROGRESS"
      ? lotFailure(409, "APPROVAL_IN_PROGRESS", "This draft is being approved. Wait for the result before changing conditions.")
      : lotFailure(403, "DEMO_SCOPE_REQUIRED", "This lot does not belong to this demo session.");
  }
  return {
    ok: true,
    lot: {
      lotId: saved.head.lotId,
      stage: saved.head.stage,
      draftConditions: saved.head.draftConditions,
      version: saved.head.version,
    },
    superseded: saved.superseded,
  };
}
