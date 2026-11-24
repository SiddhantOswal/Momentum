import { noArgs, unavailable } from "./policy.js";

export const retryExplanationTool = {
  name: "retry_explanation",
  description: "Retry a failed draft explanation after the operator requests it.",
  schema: () => noArgs,
  codeOnly: true,
  spendsGemini: true,
  effectScope: "explanation",
  // The explanation service returns text but cannot attach it to the current draft.
  precondition: () => unavailable("Retrying a saved draft explanation is unavailable."),
};
