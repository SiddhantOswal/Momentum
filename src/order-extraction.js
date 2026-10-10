import { PurchaseOrderSchema } from "./types.js";

export function extractOrderFromMock(input) {
  const result = PurchaseOrderSchema.safeParse(input);

  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const order = result.data;

  const requiredFields = [
    "boxStyle",
    "lengthMm",
    "widthMm",
    "heightMm",
    "ply",
    "fluteProfile",
    "quantity",
  ];

  const missingFields = requiredFields.filter(
    (field) => order[field] === undefined
  );

  return {
    ok: true,
    order,
    missingFields,
    needsClarification: missingFields.length > 0,
    mode: "mock",
  };
}