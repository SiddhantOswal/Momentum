import { z } from "zod";
import { loadMetricDictionary } from "../metrics/dictionary.js";
import { unavailable } from "./policy.js";

const dictionary = loadMetricDictionary();
const metricIds = dictionary.metrics.filter((m) => m.enabled).map((m) => m.id);

// Vertex takes one flat object, so the filter names are the union of every
// metric's filters. Each metric's own bounds are enforced in the query layer.
function filterShape() {
  const shape = {};
  for (const param of dictionary.metrics.flatMap((m) => m.params)) {
    let field;
    if (param.type === "enum") field = z.enum(param.values);
    else if (param.type === "number") field = z.number().min(param.min).max(param.max);
    else if (param.type === "integer") field = z.number().int().min(param.min).max(param.max);
    else field = z.string().regex(new RegExp(param.pattern));
    shape[param.name] = field.optional();
  }
  return shape;
}

export const queryMetricTool = {
  name: "query_metric",
  description: "Read a metric from the approved data dictionary.",
  schema: () => z.strictObject({ metric: z.enum(metricIds), filters: z.strictObject(filterShape()) }),
  precondition: ({ deps }) => deps.servicePorts?.availability?.queryMetric === true
    ? undefined
    : unavailable("The metric dictionary is unavailable."),
  execute: ({ metric, filters }, { deps }) => deps.servicePorts.queryMetric({
    metricId: metric, params: filters, signal: deps.signal,
  }),
};
