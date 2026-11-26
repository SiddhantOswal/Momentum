import { createHash } from "node:crypto";
import { z } from "zod";
import { validateWith } from "../../commands/validation.js";
import { runAsGeminiCaller } from "../../gemini-caller-context.js";
import { PhotoClassificationRequestSchema } from "../../google-cloud/approved-photo-service.js";
import { demoOwnsJob, demoOwnsLot, isDemoPrincipal } from "../../hackathon-demo-auth.js";
import { ArcSessionDocSchema, DiscoveredIdsSchema, EffectKeySchema, IpKeySchema, TaskStepSchema } from "../../state-schemas.js";
import { canonicalJson } from "../canonical-json.js";
import { SAMPLE_DOCUMENTS } from "../../synthetic-po-allowlist.js";
import { confirmConditionsTool } from "./confirm-conditions.js";
import { confirmOrderTool } from "./confirm-order.js";
import { diagnoseApprovedPhotoTool } from "./diagnose-approved-photo.js";
import { getJobCardTool } from "./get-job-card.js";
import { getJobTool } from "./get-job.js";
import { getLotTool } from "./get-lot.js";
import { getStatusTool } from "./get-status.js";
import { getWeatherTool } from "./get-weather.js";
import { listApprovedPhotosTool } from "./list-approved-photos.js";
import { listNextActionsTool } from "./list-next-actions.js";
import { listSamplesTool } from "./list-samples.js";
import { planLotTool } from "./plan-lot.js";
import { failure, unavailable } from "./policy.js";
import { queryMetricTool } from "./query-metric.js";
import { readOrderTool } from "./read-order.js";
import { retryExplanationTool } from "./retry-explanation.js";
import { searchDefectHistoryTool } from "./search-defect-history.js";
import { setConditionsTool } from "./set-conditions.js";

const definitions = [
  getStatusTool, listSamplesTool, readOrderTool, getWeatherTool, setConditionsTool, planLotTool,
  retryExplanationTool, getLotTool, listNextActionsTool, getJobTool, getJobCardTool,
  listApprovedPhotosTool, diagnoseApprovedPhotoTool, searchDefectHistoryTool, queryMetricTool,
  confirmOrderTool, confirmConditionsTool,
];

const stepSchema = z.strictObject({
  stepId: TaskStepSchema.shape.stepId,
  attempt: TaskStepSchema.shape.attempt,
  taskRunId: z.uuid(),
});
const leaseOwnerSchema = TaskStepSchema.shape.leaseOwner.unwrap();

function effectKey(step, args) {
  const { taskRunId, stepId, attempt } = stepSchema.parse({
    taskRunId: step?.taskRunId, stepId: step?.stepId, attempt: step?.attempt,
  });
  const hash = createHash("sha256").update(canonicalJson(args)).digest("hex");
  return EffectKeySchema.parse(`arc1.${taskRunId.replaceAll("-", "")}.${stepId}.${attempt}.${hash.slice(0, 16)}`);
}

function vertexSchema(schema) {
  // Vertex cannot express the impossible schema Zod emits for an empty enum.
  if (schema.not) return null;
  const { type, properties, required, enum: values, minimum, maximum, format, pattern } = schema;
  const fields = properties && Object.entries(properties).map(([name, value]) => [name, vertexSchema(value)]);
  if (fields?.some(([, field]) => field === null)) return null;
  return {
    type: type.toUpperCase(),
    ...(fields && { properties: Object.fromEntries(fields) }),
    ...(required && { required }),
    ...(values && { enum: values }),
    ...(minimum !== undefined && { minimum }),
    ...(maximum !== undefined && { maximum }),
    ...(format && { format }),
    ...(pattern && !format && { pattern }),
  };
}

const MAX_SAMPLE_IDS = 5;
const MAX_PHOTO_IDS = 10;
const listedPhotoIds = (ids) => ids.filter((photoId) => PhotoClassificationRequestSchema.safeParse({ photoId }).success);

// A result longer than the stored limit keeps its first IDs; the rest are not offered to the router.
function storedIds(schema, ids, isKnown, limit) {
  const parsed = schema.safeParse(Array.isArray(ids) ? [...new Set(ids.filter(isKnown))].slice(0, limit) : []);
  return parsed.success ? parsed.data : [];
}

function sessionIds(schema, ids, isOwned) {
  const parsed = schema.safeParse(Array.isArray(ids) ? [...new Set(ids.filter(isOwned))] : ids);
  return parsed.success ? Object.freeze(parsed.data) : Object.freeze([]);
}

/**
 * Instantiate for one authenticated session. IDs a discovery tool returns are
 * held here and, through discovered(), saved on the session record by the
 * runner. The next turn rebuilds the registry from that record, which is how
 * a typed request can name a photo or sample listed earlier. The runner
 * supplies lot, step and confirmation state from server records, separately
 * from the model's function arguments.
 * `fixedPlan` is set for a button's fixed plan, which may read any approved
 * sample; the model may name only the samples this session has listed.
 * Code-only tools are never declared to the model and never allowed for it.
 * Command results stay on the server. A caller must project the permitted
 * fields before building model context or a client response.
 */
export function createToolRegistry({ principal, ipKey, session, deps = {}, fixedPlan = false } = {}) {
  if (!isDemoPrincipal(principal) || session?.sessionId !== principal.sessionId) {
    throw new TypeError("A verified Arc session is required.");
  }
  const jobIds = sessionIds(ArcSessionDocSchema.shape.jobIds, session.jobIds, (id) => demoOwnsJob(principal, id));
  const lotIds = sessionIds(ArcSessionDocSchema.shape.activeLotIds, session.activeLotIds, (id) => demoOwnsLot(principal, id));
  let sampleIds = storedIds(DiscoveredIdsSchema.shape.sampleIds, fixedPlan ? Object.keys(SAMPLE_DOCUMENTS) : session.discovered?.sampleIds,
    (id) => Object.hasOwn(SAMPLE_DOCUMENTS, id), MAX_SAMPLE_IDS);
  let photoIds = storedIds(DiscoveredIdsSchema.shape.photoIds, session.discovered?.photoIds,
    (id) => listedPhotoIds([id]).length === 1, MAX_PHOTO_IDS);
  const contextFor = (context) => ({
    ...context, principal, lotIds, deps: { ...deps, principal, signal: context.signal ?? deps.signal },
  });
  const tools = Object.freeze(Object.fromEntries(definitions.map((definition) => {
    const { name, description, effectScope, spendsGemini, codeOnly } = definition;
    const schema = () => definition.schema({ sampleIds, photoIds, jobIds });
    const blockedBy = (state) => definition.precondition?.(state)
      ?? (spendsGemini && !IpKeySchema.safeParse(ipKey).success
        ? unavailable("The client address could not be verified for metering.")
        : undefined);
    const key = effectScope || spendsGemini ? effectKey : () => null;
    return [name, Object.freeze({
      name, description, schema, key, codeOnly: Boolean(codeOnly), spendsGemini: Boolean(spendsGemini),
      precondition: (context = {}) => blockedBy(contextFor(context)),
      async execute(input, context = {}) {
        if (codeOnly && context.source !== "code") {
          return failure(400, "VALIDATION_ERROR", "This tool is available only from a fixed plan.");
        }
        const validated = validateWith(schema(), input, "Tool arguments failed validation.");
        if (!validated.ok) return validated.failure;
        const state = contextFor(context);
        const blocked = blockedBy(state);
        if (blocked) return blocked;
        let effect;
        let leaseOwner;
        try {
          effect = key(state.step, validated.data);
          if (spendsGemini) leaseOwner = leaseOwnerSchema.parse(state.step.reservationOwner ?? state.step.leaseOwner);
        } catch (error) {
          if (!(error instanceof z.ZodError)) throw error;
          return unavailable("The tool step has no valid effect claim.");
        }
        state.deps.signal?.throwIfAborted();
        const run = () => definition.execute(validated.data, { ...state, key: effect });
        // A durable effect handler must replay the original result for a
        // completed claim. A process-local wrapper cannot protect a resume.
        const execute = effectScope ? () => state.deps.runWriteEffect({
          scope: effectScope, key: effect, principal, signal: state.deps.signal,
        }, run) : run;
        let callIndex = 0;
        const result = spendsGemini ? await runAsGeminiCaller({
          principal,
          ipKey,
          onReservation: state.onReservation,
          nextReservationKey: () => {
            if (state.maxGeminiAttempts !== undefined && callIndex >= state.maxGeminiAttempts) {
              throw Object.assign(new Error("This turn has used its Gemini attempts."), { code: "BUDGET_TURN_EXHAUSTED" });
            }
            return `${effect}.${leaseOwner.replaceAll("-", "").slice(0, 12)}.${callIndex++}`;
          },
        }, execute) : await execute();
        if (name === "list_samples" && result.ok) {
          sampleIds = storedIds(DiscoveredIdsSchema.shape.sampleIds, result.samples.map(({ id }) => id),
            (id) => Object.hasOwn(SAMPLE_DOCUMENTS, id), MAX_SAMPLE_IDS);
        }
        if (name === "list_approved_photos" && result.ok) {
          photoIds = storedIds(DiscoveredIdsSchema.shape.photoIds, listedPhotoIds(result.photos.map(({ id }) => id)), () => true, MAX_PHOTO_IDS);
        }
        return result;
      },
    })];
  })));

  const declarableTools = () => Object.values(tools).flatMap((tool) => {
    if (tool.codeOnly) return [];
    const parameters = vertexSchema(z.toJSONSchema(tool.schema()));
    return parameters === null ? [] : [{ tool, parameters }];
  });

  return Object.freeze({
    tools,
    discovered: () => ({ sampleIds: [...sampleIds], photoIds: [...photoIds] }),
    declarations: () => [{
      functionDeclarations: declarableTools().map(({ tool: { name, description }, parameters }) => ({
        name, description, parameters,
      })),
    }],
    allowedFunctionNames: (context = {}) => declarableTools()
      .filter(({ tool }) => !tool.precondition(context))
      .map(({ tool }) => tool.name),
    execute(name, args, context) {
      if (typeof name !== "string" || !Object.hasOwn(tools, name)) {
        return failure(400, "VALIDATION_ERROR", "Unknown Arc tool.");
      }
      return tools[name].execute(args, context);
    },
  });
}
