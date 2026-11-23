# Vertex AI request settings reference for Arc (ARC-M1-15)

Owner: AI engineer. Written 2026-11-23. The verification auditor checks this record against the sources below.

Scope: the `generateContent` request and response fields that ARC-M1-12 and ARC-M1-14 will use, for `gemini-3.5-flash` and `gemini-3.5-flash-lite` in `asia-south1`, project `prepagent-hack`. Nothing here was sent to `generateContent`. No Gemini attempt was spent.

## How this was checked

- Pages were fetched with `curl -sL` and stripped to text with a short local script. Every requested `docs.cloud.google.com/vertex-ai/generative-ai/docs/...` URL now redirects to `docs.cloud.google.com/gemini-enterprise-agent-platform/...`; the product pages are titled "Gemini Enterprise Agent Platform". The API host is unchanged: `{location}-aiplatform.googleapis.com/v1`. Every docs page below shows "Last updated 2026-11-20 UTC".
- The published v1 API schema (discovery document) was fetched the same way. It lists the exact JSON field names and enum values the API parses.
- Live check: 34 `countTokens` calls (17 request shapes on each model) in `asia-south1` with the logged-in gcloud identity. The token was read inside the script and never printed. `countTokens` has no charge and does not generate content (S12). It uses the same parser as `generateContent` for the fields the two share, and it rejects unknown fields, so a 200 confirms a field name and an enum spelling. It does not confirm that a model honours a value: it accepted `XHIGH`, which the docs say neither model supports. `countTokens` has no `safetySettings` or `toolConfig` field, so those names cannot be checked live without `generateContent`.
- Date read for every row: 2026-11-23 IST (2026-11-22 UTC). The live probe ran at 21:48 UTC and D1 was fetched at 21:49 UTC.

### Sources

| ID | Source | URL |
|---|---|---|
| S1 | Generate content API reference | https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/inference |
| S2 | Safety and content filters | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/configure-safety-filters |
| S3 | Thinking | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking |
| S4 | Function calling guide | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tools/function-calling |
| S5 | Function calling API reference | https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/function-calling |
| S6 | Gemini 3.5 Flash model page | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash |
| S7 | Gemini 3.5 Flash-Lite model page | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite |
| S8 | Process blocked responses | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/process-blocked-responses |
| S9 | System instructions | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/prompts/system-instructions |
| S10 | Thought signatures | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking/thought-signatures |
| S11 | CountTokens API reference | https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/count-tokens |
| S12 | Get token count (pricing and quota) | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/get-token-count |
| D1 | aiplatform v1 discovery document, revision 20261114 | https://aiplatform.googleapis.com/$discovery/rest?version=v1 |
| L1 | Live `countTokens` probe, both models, `asia-south1` | Results in "Live probe results" below |

"NOT CONFIRMED (LIVE)" means the name is confirmed by the docs and D1 but can only be tested on `generateContent`. ARC-M1-14 tests it with one live call per role on a tagged revision, counted against the Gemini budget.

## 1. Models

| Fact | `gemini-3.5-flash` | `gemini-3.5-flash-lite` | Source |
|---|---|---|---|
| Launch stage | GA, released 19 May 2026 | GA, released 21 July 2026 | S6, S7 |
| `asia-south1` listed under model availability and ML processing | Yes | Yes (the only Asia Pacific region listed) | S6, S7 |
| System instructions, thinking, structured output, function calling, Count Tokens API | Supported | Supported | S6, S7 |
| Temperature | 0.0 to 2.0, default 1.0 | Fixed at 1.0. "Custom values for parameters like temperature, top-K, and top-P aren't supported. If you set a custom value for these parameters, that value will be ignored." | S6, S7 |
| `presencePenalty`, `frequencyPenalty` | Range -2.0 to under 2.0 (S1) | Custom values return an error | S1, S7 |
| Last turn with role `model` | Allowed | Returns an error | S7 |
| Maximum output tokens | 65,536 | 65,536 | S6, S7 |

This settles the ADR-0008 condition: `gemini-3.5-flash-lite` is GA, so the router may use it.

## 2. Safety settings

Request field: `safetySettings`, an array of `{ "category", "threshold", "method" }` on the top level of the `generateContent` body (S1, S2, D1). `category` and `threshold` are required in each entry; `method` is optional (D1).

| Name | Value | Status | Source |
|---|---|---|---|
| Request field | `safetySettings` | Docs and D1 confirm. NOT CONFIRMED (LIVE): `countTokens` rejects it as an unknown field | S1, S2, D1, L1 |
| Harm category | `HARM_CATEGORY_HATE_SPEECH` | Confirmed | S1, S2, D1 |
| Harm category | `HARM_CATEGORY_DANGEROUS_CONTENT` | Confirmed | S1, S2, D1 |
| Harm category | `HARM_CATEGORY_HARASSMENT` | Confirmed | S1, S2, D1 |
| Harm category | `HARM_CATEGORY_SEXUALLY_EXPLICIT` | Confirmed | S1, S2, D1 |
| Harm category | `HARM_CATEGORY_JAILBREAK` | In D1. S2: "only available in gemini-3-flash-preview", Preview. Not for Arc's models | S2, D1 |
| Harm category | `HARM_CATEGORY_CIVIC_INTEGRITY` | D1 marks it deprecated. Not for Arc | D1 |
| Harm category | `HARM_CATEGORY_IMAGE_HATE`, `_IMAGE_DANGEROUS_CONTENT`, `_IMAGE_HARASSMENT`, `_IMAGE_SEXUALLY_EXPLICIT` | In D1 only. The text-model pages (S1, S2) do not list them. Not for Arc | D1 |

The four text categories are the same four that RAI-5 names. They are the only categories S1 and S2 list for the Gemini text models.

### Thresholds

| Value | Meaning | Source |
|---|---|---|
| `BLOCK_LOW_AND_ABOVE` | Block when the probability score or the severity score is LOW, MEDIUM or HIGH. Blocks the most | S2 |
| `BLOCK_MEDIUM_AND_ABOVE` | Block when the probability score or the severity score is MEDIUM or HIGH | S2 |
| `BLOCK_ONLY_HIGH` | Block when the probability score or the severity score is HIGH. Blocks the least | S2 |
| `BLOCK_NONE` | Removes automated blocking; scores are still returned so you can apply your own rules | S2 |
| `OFF` | No automated blocking and no metadata returned. S1: "Switches off safety if all categories are turned OFF" | S1, S2 |
| `HARM_BLOCK_THRESHOLD_UNSPECIFIED` | "Block using the default threshold" | S1, S2 |

Each threshold names the score it applies to through `method`:

| `method` value | Meaning | Source |
|---|---|---|
| `SEVERITY` | Uses both the probability and the severity score | S1, S2, D1 |
| `PROBABILITY` | Uses the probability score only | S1, S2, D1 |

### Defaults and access

| Question | What the sources say | Status |
|---|---|---|
| Threshold when `safetySettings` is omitted | S2 (Gemini API section): "For gemini-3.5-flash and subsequent models, OFF is the default value." The console section also lists "Off (default)". The REST section of the same page lists `BLOCK_MEDIUM_AND_ABOVE (default)`. S2 does not name `gemini-3.5-flash-lite`, which was released after `gemini-3.5-flash` | NOT CONFIRMED. The page contradicts itself; the more specific statement says OFF for `gemini-3.5-flash`. Either way, today's calls may run with no blocking. Sending explicit settings removes the question |
| `method` when omitted | S2: "The default method is SEVERITY." S1 and D1: "If not specified, the threshold is used for probability score." | NOT CONFIRMED. The sources disagree. Send `method` explicitly |
| Does `BLOCK_NONE` or `OFF` need special access? | None of S1, S2 or D1 mentions an access requirement, allowlist or billing condition for either value | NOT CONFIRMED that no restriction applies. Not needed: Arc uses neither value |

## 3. System instruction

| Name | Value | Status | Source |
|---|---|---|---|
| Request field | `systemInstruction`, a `Content` object: `{ "parts": [ { "text": "..." } ] }` | Confirmed live: 200 on both models; the count rose from 13 to 23 tokens | S1, D1, L1 |
| `role` inside it | Ignored. S1: "The role field of systemInstruction is ignored and doesn't affect the performance of the model." A body with `"role": "user"` also returned 200 with the same count | S1, S11, L1 |
| Part types | Text only. Each part is read as a separate paragraph | S1, D1 |
| Limits | Counts toward the input token limit. "They don't fully prevent jailbreaks or leaks." | S1, S9 |

## 4. Thinking

Request field: `generationConfig.thinkingConfig` (S1, D1).

| Name | Value | Status | Source |
|---|---|---|---|
| `thinkingConfig.thinkingLevel` | `MINIMAL`, `LOW`, `MEDIUM`, `HIGH` on both models | Field and spellings confirmed live (200 on both models; an invalid value returns 400 "Invalid value at 'generation_config.thinking_config.thinking_level'"). Per-model support: docs only, NOT CONFIRMED (LIVE) | S3, D1, L1 |
| Default level | `gemini-3.5-flash`: `MEDIUM`. `gemini-3.5-flash-lite`: `MINIMAL` | Docs | S3, S7 |
| `XHIGH` | In D1 and accepted by `countTokens`, but S3 lists it only for Gemini 4 Neon and Gemini 4 Hydrogen | Not for Arc | S3, D1, L1 |
| `thinkingConfig.includeThoughts` | Boolean. When true, thought summaries are returned as parts with `thought: true` | Field confirmed live (`false` returned 200). The default when omitted is not stated: NOT CONFIRMED | S3, D1, L1 |
| `thinkingConfig.thinkingBudget` | Deprecated for Gemini 3. S3: using it on Gemini 3 "can cause intermittent 400: INVALID_ARGUMENT errors", and sending it with `thinkingLevel` returns an error | Do not send | S1, S3 |
| Turning thinking off | Not possible on Gemini 3 and later. `MINIMAL` still produces thought signatures | Docs | S10 |
| Thought signatures | `thoughtSignature` on any returned part. With function calls, the `functionCall` part must be sent back unchanged with its signature, or the request fails with 400. This applies at `MINIMAL` too | Docs | S1, S3, S10 |
| Flash-Lite guidance | `MINIMAL` suits "classification, routing, or JSON extraction"; `MEDIUM` or `HIGH` for multi-step tool use, because "Using the minimal thinking level can cause premature tool termination on multi-step tasks." | Docs | S7 |
| Billing | Thinking tokens are billed. `usageMetadata.thoughtsTokenCount` reports them | Docs | S3 |

## 5. Function calling

Request field: `toolConfig.functionCallingConfig` (S4, S5, D1).

| Name | Value | Status | Source |
|---|---|---|---|
| `toolConfig` | Top-level request field, shared by all tools in the request | Docs and D1. NOT CONFIRMED (LIVE): `countTokens` rejects it as an unknown field | S1, D1, L1 |
| `functionCallingConfig.mode` = `AUTO` | Default. The model chooses a function call or text | Docs and D1 | S4, S5, D1 |
| `mode` = `ANY` | The model always returns one or more function calls and follows the declared schema | Docs and D1 | S4, S5, D1 |
| `mode` = `NONE` | No function calls; same as sending no declarations | Docs and D1 | S4, S5, D1 |
| `mode` = `VALIDATED` | Function call or text, with schema adherence; from Gemini 3 it also enforces required parameters | In S4 and D1, missing from S5. NOT CONFIRMED (LIVE) on these models | S4, D1 |
| `functionCallingConfig.allowedFunctionNames` | Array of declared function names. S5 and D1: "Only set when the Mode is ANY." S4 says `VALIDATED` also honours it | Confirmed for `ANY`. With `VALIDATED`: NOT CONFIRMED | S4, S5, D1 |
| `functionCallingConfig.streamFunctionCallArguments` | Boolean, default false | Not used by Arc | S5, D1 |
| `tools[].functionDeclarations` | `name`, `description`, `parameters` | Confirmed live (200; count rose from 13 to 28) | S1, S5, L1 |
| Function name rules | Starts with a letter or underscore; a-z, A-Z, 0-9, underscore, dot, dash; at most 64 characters | Docs | S4, S5 |
| Declarations per request | At most 128. S4 advises keeping the active set to 10 to 20 | Docs | S4, S5 |
| Parallel calls | Send every `functionResponse` together in one `Content`, in the same order as the calls, each `name` equal to its call's `name`. `id` matching needs v1beta1; Arc uses v1 | Docs | S4, S10 |

## 6. Blocked responses

| Case | What the response contains | Source |
|---|---|---|
| Prompt blocked | `promptFeedback.blockReason` is set and `candidates` is not set. Values: `SAFETY`, `OTHER`, `BLOCKLIST`, `PROHIBITED_CONTENT`, `MODEL_ARMOR`, `IMAGE_SAFETY`, `JAILBREAK`, `BLOCKED_REASON_UNSPECIFIED`. `promptFeedback` also carries `safetyRatings` and `blockReasonMessage` | S2, S8, D1 |
| Response blocked | `promptFeedback` is not set. `candidates[0].content` is not set and `candidates[0].finishReason` says why | S2, S8 |
| Blocked by the configurable filter | `finishReason` is `SAFETY`. Each `candidates[0].safetyRatings[]` entry has `category`, `probability` (`NEGLIGIBLE`, `LOW`, `MEDIUM`, `HIGH`), `probabilityScore`, `severity` (`HARM_SEVERITY_NEGLIGIBLE` to `HARM_SEVERITY_HIGH`), `severityScore`, and `blocked: true` on the category that blocked | S2, D1 |
| Other block reasons in `finishReason` | `PROHIBITED_CONTENT`, `SPII`, `BLOCKLIST`, `RECITATION`, `MODEL_ARMOR`, `IMAGE_SAFETY`. Tool problems: `MALFORMED_FUNCTION_CALL`, `UNEXPECTED_TOOL_CALL`, `TOO_MANY_TOOL_CALLS` | S2, D1 |
| `finishReason` spelling | Bare values on the wire, for example `"SAFETY"` and `"MAX_TOKENS"` (D1 and the JSON examples in S2). S1's table prefixes them (`FINISH_REASON_SAFETY`); that is a doc inconsistency. The client already matches the bare `"MAX_TOKENS"` | S1, S2, D1 |
| HTTP status of a blocked result | Not stated. The examples show normal response bodies | NOT CONFIRMED (LIVE) |

## 7. What `vertex-gemini-client.js` sends today

Read from `src/google-cloud/vertex-gemini-client.js` on branch `arc/main` at ff20832. Endpoint: `https://asia-south1-aiplatform.googleapis.com/v1/projects/prepagent-hack/locations/asia-south1/publishers/google/models/{model}:generateContent` (`config/gcp-vertex-ai.json`).

| Method | Body sent | Not sent |
|---|---|---|
| `generateContent` | `contents`; `tools` when given, and then always `toolConfig: { functionCallingConfig: { mode: "AUTO" } }` (hard-coded); `generationConfig: { temperature: 0, maxOutputTokens }` (default 2,048, at most 8,192) | `systemInstruction`, `safetySettings`, `thinkingConfig`, `allowedFunctionNames` |
| `generateJson` | One user turn: `fileData { fileUri, mimeType }` and the prompt text; `generationConfig: { temperature: 0, maxOutputTokens: 2048, responseMimeType: "application/json", responseSchema }` | `systemInstruction`, `safetySettings`, `thinkingConfig`, `tools` |

Callers: `order-extraction-service.js` and the two photo services (`approved-photo-service.js`, `defect-diagnosis-service.js`) use `generateJson`. `risk-evidence-service.js` uses `generateContent` with no tools and `maxOutputTokens: 8192`. `gemini-function-runner.js` uses `generateContent` with tools, so mode `AUTO`.

Response handling today, with the gaps ARC-M1-14 closes:

- `finishReason: "MAX_TOKENS"` becomes `VERTEX_OUTPUT_TRUNCATED`. No other `finishReason` is checked.
- A blocked prompt (no `candidates`) and a blocked response (no `content`) both fall through to `VERTEX_EMPTY_RESPONSE`, the same code as an empty answer. `promptFeedback` and `safetyRatings` are never read.
- A non-2xx status or an `error` body becomes `VERTEX_GENERATION_FAILED`.
- The 64 KiB request-size check covers `contents` and `tools` only. A `systemInstruction` needs to be inside that check.
- `gemini-function-runner.js` and `risk-evidence-service.js` join every text part. If `includeThoughts` were true, thought summaries would be joined into the answer.
- `gemini-function-runner.js` pushes the model's `Content` back unchanged, so thought signatures on `functionCall` parts are kept (S10).

## 8. Recommended settings per Arc role

For ARC-M1-12 and ARC-M1-14, to be stored per role in `config/arc-models.json`. Model and region per role are from ADR-0008. Field names use the camelCase JSON names in D1. Everything marked NOT CONFIRMED (LIVE) above is checked by the ARC-M1-14 smoke call on a tagged revision before release; a 400 there means this record is wrong and must be corrected first.

Shared safety block, sent on every request:

```json
"safetySettings": [
  { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE", "method": "PROBABILITY" },
  { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE", "method": "PROBABILITY" },
  { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE", "method": "PROBABILITY" },
  { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE", "method": "PROBABILITY" }
]
```

- Categories and threshold are RAI-5 as written.
- `method` is new and needs the responsible-AI reviewer's agreement, because RAI-5 does not name it. It is set explicitly because the sources disagree on the default (section 2). `PROBABILITY` matches S1, D1 and the console. `SEVERITY` was rejected for now: it blocks when either score passes the line, so it is more likely to stop plant text about cracks, steam and boilers. The `scope-refusal` suite can revisit this.
- `HARM_CATEGORY_JAILBREAK` is left out: S2 limits it to `gemini-3-flash-preview`.

Per role:

```json
{
  "extraction": {
    "model": "gemini-3.5-flash", "location": "asia-south1",
    "systemInstruction": { "parts": [ { "text": "<prompts/extraction, versioned>" } ] },
    "generationConfig": {
      "temperature": 0, "maxOutputTokens": 2048,
      "responseMimeType": "application/json", "responseSchema": "<unchanged>",
      "thinkingConfig": { "thinkingLevel": "MEDIUM", "includeThoughts": false }
    }
  },
  "explanation": {
    "model": "gemini-3.5-flash", "location": "asia-south1",
    "systemInstruction": { "parts": [ { "text": "<prompts/explanation, versioned>" } ] },
    "generationConfig": {
      "temperature": 0, "maxOutputTokens": 8192,
      "thinkingConfig": { "thinkingLevel": "MEDIUM", "includeThoughts": false }
    }
  },
  "photo": {
    "model": "gemini-3.5-flash", "location": "asia-south1",
    "systemInstruction": { "parts": [ { "text": "<prompts/photo, versioned>" } ] },
    "generationConfig": {
      "temperature": 0, "maxOutputTokens": 2048,
      "responseMimeType": "application/json", "responseSchema": "<unchanged>",
      "thinkingConfig": { "thinkingLevel": "MEDIUM", "includeThoughts": false }
    }
  },
  "router": {
    "model": "gemini-3.5-flash-lite", "fallbackModel": "gemini-3.5-flash", "location": "asia-south1",
    "systemInstruction": { "parts": [ { "text": "<prompts/router, versioned>" } ] },
    "toolConfig": { "functionCallingConfig": { "mode": "ANY", "allowedFunctionNames": ["<per lot state>"] } },
    "generationConfig": {
      "maxOutputTokens": 1024,
      "thinkingConfig": { "thinkingLevel": "MINIMAL", "includeThoughts": false }
    }
  },
  "answerWriter": {
    "model": "gemini-3.5-flash", "location": "asia-south1",
    "systemInstruction": { "parts": [ { "text": "<prompts/answer-writer, versioned>" } ] },
    "generationConfig": {
      "temperature": 0, "maxOutputTokens": 2048,
      "thinkingConfig": { "thinkingLevel": "LOW", "includeThoughts": false }
    }
  }
}
```

Reasons:

- Extraction, explanation and photo: `MEDIUM` is the documented default for `gemini-3.5-flash` (S3), so stating it keeps today's behaviour, as the ARC-M1-12 acceptance criteria require. A lower level is a separate change with its own eval run. Output limits are today's values.
- Router: `MINIMAL` is the Flash-Lite default and the level S7 gives for routing. The router makes one call and code runs the tools, so the multi-step warning in S7 does not apply. History reaches the router as structured summaries, never as earlier `functionCall` parts, so the signature rule in S10 does not apply either. The same level is used on the fallback model so the `off-topic` and `scope-refusal` comparison changes one thing only. `temperature` is left out because Flash-Lite ignores it (S7). Penalty fields must never be sent to Flash-Lite (S7). The 1,024 output limit is a proposal: ADR-0008 budgets about 300 output tokens, not measured.
- Router `toolConfig`: `ANY` with `allowedFunctionNames` per state is ADR-0007, and S5 and D1 confirm the pairing. `VALIDATED` is not used.
- Answer writer: a new role with no output to preserve. `LOW` because the one recorded measurement, the explanation prompt on `gemini-3.5-flash` at the default level, used 1,964 thinking tokens (`risk-evidence-service.js`). That would nearly fill the 2,048 limit; ADR-0008 budgets 400. No `tools` and no `toolConfig`.
- `includeThoughts: false` on every role, because callers join all text parts and the default is not stated.
- `temperature: 0`: S1 and S6 give a range of 0.0 to 2.0, while D1 describes it as (0.0, 2.0]. The client has sent 0 since commit 8c7e9a4, and the explanation call that recorded 1,964 thinking tokens (commit 06f8faf, `gemini-3.5-flash` in `asia-south1`) ran with it. Kept.
- `systemInstruction` text comes only from versioned files in `prompts/`. Order-derived or photo-derived strings never go into it (ADR-0010).
- The V2 agent path in `gemini-function-runner.js` keeps `AUTO`, now read from config instead of hard-coded.

Blocked-result handling for ARC-M1-14 (the error code names are proposals; ARC-M1-14 decides them):

- `promptFeedback.blockReason` present: a prompt-blocked code, with the `blockReason` value recorded.
- `finishReason` in `SAFETY`, `PROHIBITED_CONTENT`, `SPII`, `BLOCKLIST`, `RECITATION`, `MODEL_ARMOR`, `IMAGE_SAFETY`: a response-blocked code, recording `finishReason` and the categories with `blocked: true`.
- `MALFORMED_FUNCTION_CALL`, `UNEXPECTED_TOOL_CALL`, `TOO_MANY_TOOL_CALLS`: a tool-call error code.
- None of these may reach the user as an empty or partial answer (RAI-5).

## 9. NOT CONFIRMED items

1. On `generateContent` for both models in `asia-south1`: acceptance of `safetySettings` (with `method`), `toolConfig.functionCallingConfig` with `ANY` and `allowedFunctionNames`, and each recommended `thinkingLevel`. NOT CONFIRMED (LIVE); ARC-M1-14 checks them.
2. The threshold used when `safetySettings` is omitted (S2 contradicts itself; Flash-Lite is not named).
3. The default `method` (S2 says `SEVERITY`; S1 and D1 say probability).
4. Whether `BLOCK_NONE` or `OFF` needs special access (no source says so). Arc uses neither.
5. `allowedFunctionNames` with mode `VALIDATED` (S4 says yes; S5 and D1 say `ANY` only). Arc does not use `VALIDATED`.
6. The default of `includeThoughts`. Arc sends `false`.
7. The HTTP status of a blocked result.

Items 2, 3 and 6 are defaults, not names. Arc does not rely on them: section 8 sends an explicit value for each. Items 4 and 5 are values Arc does not send. Item 7 means ARC-M1-14 must detect a block from the body, whatever the status.

## 10. Other findings for the owners

- S6 and S7 list Standard PayGo only for `global`, `us` and `eu`; `asia-south1` appears under model availability, ML processing and Provisioned Throughput. Which billing tier regional `asia-south1` calls use is NOT CONFIRMED. The client is configured for `asia-south1` today (`config/gcp-vertex-ai.json`), and a live call ran there at commit 06f8faf. This is a question for the release manager about price and quota, not a blocker for M1.
- `responsible-ai.md` ("Known gaps on 2026-11-22") still says the RAI-5 names are unchecked, and links the old `cloud.google.com/vertex-ai/...` URLs. Its owner should point it at this record.

## Live probe results (L1)

Request: `POST https://asia-south1-aiplatform.googleapis.com/v1/projects/prepagent-hack/locations/asia-south1/publishers/google/models/{model}:countTokens`. Base body: one user turn with 13 tokens of text. Both models returned the same result for every row.

| Added to the base body | Result |
|---|---|
| nothing | 200, 13 tokens |
| `notARealField: 1` | 400, `Unknown name "notARealField": Cannot find field.` |
| `systemInstruction: { parts: [{ text }] }` | 200, 23 tokens |
| the same with `role: "user"` | 200, 23 tokens |
| `tools: [{ functionDeclarations: [one function] }]` | 200, 28 tokens |
| `generationConfig: {}` | 200, 13 tokens |
| `generationConfig: { temperature: 0 }` | 200, 13 tokens |
| `thinkingConfig.thinkingLevel`: `MINIMAL`, `LOW`, `MEDIUM`, `HIGH`, `XHIGH` | 200 for each, 13 tokens |
| `thinkingConfig.thinkingLevel: "NOT_A_LEVEL"` | 400, `Invalid value at 'generation_config.thinking_config.thinking_level'` |
| `thinkingConfig.includeThoughts: false` | 200, 13 tokens |
| `thinkingConfig.notARealField: 1` | 400, `Unknown name "notARealField" at 'generation_config.thinking_config'` |
| `safetySettings: [one entry]` | 400, `Unknown name "safetySettings": Cannot find field.` |
| `tools` plus `toolConfig: { functionCallingConfig: { mode: "AUTO" } }` | 400, `Unknown name "toolConfig": Cannot find field.` |

The two 400s for `safetySettings` and `toolConfig` match D1: `CountTokensRequest` has `contents`, `systemInstruction`, `tools`, `generationConfig`, `instances` and `model`, and no safety or tool config. They say nothing about `generateContent`, where D1 lists both fields.
