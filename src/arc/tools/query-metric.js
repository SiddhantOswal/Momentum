import { z } from "zod";
import { unavailable } from "./policy.js";

export const queryMetricTool = {
  name: "query_metric",
  description: "Read a metric from the approved data dictionary.",
  // The dictionary and its allow-listed sources belong to ARC-M4-01.
  schema: () => z.strictObject({ metric: z.enum([]), filters: z.strictObject({}) }),
  precondition: () => unavailable("The metric dictionary is unavailable."),
};
