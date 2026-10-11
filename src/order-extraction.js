import {
  MissingOrderFieldSchema,
  OrderExtractionInputSchema,
  OrderExtractionResultSchema,
  PURCHASE_ORDER_FIELDS,
  ValidationFailureSchema,
} from "./schemas.js";

function validationFailure(error) {
  const response = {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Purchase order fields failed validation.",
      issues: error.issues.map((issue) => ({
        field: issue.path.join(".") || "root",
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })),
    },
  };

  return ValidationFailureSchema.parse(response);
}

export function extractOrderFromMock(input) {
  const result = OrderExtractionInputSchema.safeParse(input);

  if (!result.success) {
    return validationFailure(result.error);
  }

  const missingFields = PURCHASE_ORDER_FIELDS
    .filter((field) => result.data[field] === undefined)
    .map((field) => MissingOrderFieldSchema.parse(field));

  return OrderExtractionResultSchema.parse({
    orderProfile: result.data,
    missingFields,
    needsClarification: missingFields.length > 0,
  });
}
