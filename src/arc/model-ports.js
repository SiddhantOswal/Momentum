import { createArcRouter } from "./router.js";
import { createScopeRules } from "./scope-rules.js";

/**
 * The model-facing ports for the Arc turn runner. With no router client or no
 * budget store the router stays undefined, and the runner answers typed text
 * with SERVICE_UNAVAILABLE instead of spending anything. The scope rules still
 * apply, since they never call a model.
 */
export function createArcModelPorts(servicePorts, { log } = {}) {
  const { routerClient, attemptStore, dailyCap } = servicePorts.arcGemini ?? {};
  const scope = createScopeRules({ log });
  const metered = routerClient !== undefined && attemptStore !== undefined && dailyCap !== undefined;
  return {
    preRoute: scope.preRoute,
    renderReply: scope.renderReply,
    ...(metered && { router: createArcRouter({ client: routerClient, scope }), attemptStore, geminiCap: dailyCap }),
  };
}
