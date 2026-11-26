import { z } from "zod";
import { SAMPLE_DOCUMENTS } from "../synthetic-po-allowlist.js";
import { ConfirmConditionsSchema } from "./tools/confirm-conditions.js";
import { ConfirmOrderSchema } from "./tools/confirm-order.js";
import { noArgs } from "./tools/policy.js";

// One strict schema per action that takes params; every other action takes none. Values are
// flat scalars, as the wire contract allows (06 section 4.4, decision D12).
const ACTION_PARAMS = Object.freeze({
  read_sample_order: z.strictObject({ sampleId: z.enum(Object.keys(SAMPLE_DOCUMENTS)) }),
  confirm_order: ConfirmOrderSchema,
  confirm_conditions: ConfirmConditionsSchema,
});

export const takesParams = (actionId) => Object.hasOwn(ACTION_PARAMS, actionId);
export const actionParamsSchema = (actionId) => takesParams(actionId) ? ACTION_PARAMS[actionId] : noArgs;
