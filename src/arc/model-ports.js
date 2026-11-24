import { renderTemplate } from "./answer-render.js";
import { createArcWriter } from "./answer-writer.js";
import { createArcRouter } from "./router.js";
import { createScopeRules } from "./scope-rules.js";

/**
 * The model-facing ports for the Arc turn runner. With no Gemini client or no
 * budget store the router and the writer stay undefined, and the runner answers
 * typed text with SERVICE_UNAVAILABLE instead of spending anything. The scope
 * rules and the template answer still apply, since they never call a model.
 * The router and the writer share one Vertex client: each request names its
 * role, and the role's model, region and prompt come from config/arc-models.json.
 */
export function createArcModelPorts(servicePorts, { log = () => {} } = {}) {
  const { routerClient, attemptStore, dailyCap } = servicePorts.arcGemini ?? {};
  const scope = createScopeRules({ log });
  const metered = routerClient !== undefined && attemptStore !== undefined && dailyCap !== undefined;
  return {
    preRoute: scope.preRoute,
    renderReply: scope.renderReply,
    renderTemplate,
    log,
    ...(metered && {
      router: createArcRouter({ client: routerClient, scope }),
      writer: createArcWriter({ client: routerClient }),
      attemptStore,
      geminiCap: dailyCap,
    }),
  };
}
