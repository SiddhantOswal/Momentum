// Loads config/arc-models.json and the versioned prompt files it names. Every
// Gemini request reads its model, thinking level and safety settings from here,
// so a stored result can name the exact settings and prompt version it ran with.
import { readFileSync } from "node:fs";
import { z } from "zod";
import arcModels from "../config/arc-models.json" with { type: "json" };

export const ARC_MODEL_ROLES = Object.freeze(["extraction", "explanation", "photo", "router", "writer", "agent"]);
export const HARM_CATEGORIES = Object.freeze([
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
]);

const ModelIdSchema = z.string().regex(/^gemini-[a-z0-9.-]{1,64}$/);
const PromptIdSchema = z.string().regex(/^[a-z]+\/v[1-9]\d*$/);

// BLOCK_NONE, OFF and the unspecified default are left out on purpose: RAI-5
// requires an explicit blocking threshold on every request.
const SafetySettingSchema = z.object({
  category: z.enum(HARM_CATEGORIES),
  threshold: z.enum(["BLOCK_LOW_AND_ABOVE", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_ONLY_HIGH"]),
  method: z.enum(["PROBABILITY", "SEVERITY"]),
}).strict();

// Strict, so a deprecated field such as thinkingBudget cannot be added by accident.
const RoleSchema = z.object({
  model: ModelIdSchema,
  fallbackModel: ModelIdSchema.optional(),
  location: z.string().regex(/^[a-z0-9-]+$/),
  temperature: z.number().min(0).max(2).nullable(),
  maxOutputTokens: z.number().int().min(1).max(8192),
  thinkingLevel: z.enum(["MINIMAL", "LOW", "MEDIUM", "HIGH"]),
  includeThoughts: z.literal(false),
  functionCallingMode: z.enum(["AUTO", "ANY", "NONE"]).nullable(),
  prompt: PromptIdSchema.nullable(),
}).strict();

const ArcModelsSchema = z.object({
  version: z.string().regex(/^arc-models-v[1-9]\d*$/),
  safetySettings: z.array(SafetySettingSchema).length(HARM_CATEGORIES.length).refine(
    (settings) => new Set(settings.map((setting) => setting.category)).size === HARM_CATEGORIES.length,
    { message: "Each harm category must appear exactly once." },
  ),
  roles: z.object(Object.fromEntries(ARC_MODEL_ROLES.map((role) => [role, RoleSchema]))).strict(),
}).strict();

const DEFAULT_PROMPT_ROOT = new URL("../prompts/", import.meta.url);

function readPrompt(promptRoot, promptId, name) {
  if (!PromptIdSchema.safeParse(promptId).success || !/^[a-z]+$/.test(name)) {
    throw new TypeError("A versioned prompt ID and a plain prompt name are required.");
  }
  // Files end with one newline for editors; the request text never did.
  const text = readFileSync(new URL(`${promptId}/${name}.txt`, promptRoot), "utf8").replace(/\n$/, "");
  if (text.trim().length === 0) throw new TypeError(`Prompt ${promptId}/${name} is empty.`);
  return text;
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function loadArcModelSettings({ config = arcModels, promptRoot = DEFAULT_PROMPT_ROOT } = {}) {
  const parsed = ArcModelsSchema.parse(config);
  const roles = Object.fromEntries(Object.entries(parsed.roles).map(([role, settings]) => [role, {
    ...settings,
    systemInstruction: settings.prompt === null ? null : readPrompt(promptRoot, settings.prompt, "system"),
  }]));
  const prompts = Object.fromEntries(Object.entries(parsed.roles)
    .filter(([, settings]) => settings.prompt !== null)
    .map(([role, settings]) => [role, settings.prompt]));
  return deepFreeze({
    version: parsed.version,
    safetySettings: parsed.safetySettings,
    roles,
    /** The task text for a role, read from the role's versioned prompt folder. */
    taskPrompt(role, name = "task") {
      if (!Object.hasOwn(prompts, role)) throw new TypeError(`Role ${role} has no versioned prompt.`);
      return readPrompt(promptRoot, prompts[role], name);
    },
    /** What a stored result records about the settings it was generated with. */
    generation(role) {
      if (!Object.hasOwn(roles, role)) throw new TypeError(`Unknown model role ${role}.`);
      return { settingsVersion: parsed.version, promptVersion: roles[role].prompt };
    },
  });
}

export const arcModelSettings = loadArcModelSettings();
