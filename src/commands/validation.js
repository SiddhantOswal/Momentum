import { DisplayPrefsQuerySchema, ValidationFailureSchema } from "../schemas.js";

export function validationFailure(issues, message = "Request fields failed validation.") {
  return ValidationFailureSchema.parse({
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message,
      issues,
    },
  });
}

export function validateWith(schema, input, message) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      failure: validationFailure(
        parsed.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          path: issue.path,
          code: issue.code,
          message: issue.message,
        })),
        message
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export function validateDisplayPrefs({ lang, currency } = {}) {
  return validateWith(DisplayPrefsQuerySchema, { lang, currency }, "Display preferences failed validation.");
}
