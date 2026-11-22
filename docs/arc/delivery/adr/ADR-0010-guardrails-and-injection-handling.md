# ADR-0010: Guardrail order and handling of untrusted content

Status: Proposed
Date: 2026-11-23 (amended the same day for founder decision A3)
Author role: AI architect
Related: `05-ai-design.md` section 5; `responsible-ai.md` RAI-1 to RAI-7; ADR-0001 items 1, 2, 3 and 9; ADR-0003, ADR-0004

## Context

- Content from orders, photos and documents is untrusted and can never grant a capability, change a rule or label, or trigger an action (CLAUDE.md section 4; spec 3.3).
- Arc cannot approve. Approval needs the checkbox and the Approve press (spec 3.4).
- Today: extraction and photo calls use `responseSchema` and say to ignore text in the image; the explanation service checks numbers, drivers and causal wording; no request sets `safetySettings` (RAI-5 gap); the cap returns `GEMINI_DAILY_CAP_EXCEEDED`.
- ADR-0001 kept four ideas from the Codex work: the answer must match tool results, cite only tool-returned IDs, run deterministic checks first, and use an injection tripwire only as a logged signal.

## Decision

Checks run in this order. A later check can only make the outcome stricter, never relax it.

1. **Transport.** Existing session, same-origin, per-IP rate limit and body limits. Arc text is capped at 1,000 characters.
2. **Deterministic scope rules.** NFKC normalisation. Buttons and exact suggestion text map to fixed plans. An approval-phrase rule, kept in a versioned file per locale, returns the approval card with fixed copy (G11). None of these call the model.
3. **Budget.** The ADR-0004 budget check runs before any model call. On refusal, Arc shows the cap state and keeps button paths working.
4. **Router and scope classifier.** One Gemini call, mode `ANY`, functions allowed for the current state only, explicit safety settings, versioned system prompt.
5. **Untrusted content as data.** PO bytes go only to the extraction call. Photo bytes go only to the photo calls. The router never sees document or image content; it sees schema-validated fields marked as data, with length limits. Extracted strings are never put in a system instruction or treated as instructions.
6. **Injection tripwire, log only.** Patterns run over extracted string fields and photo `visibleSigns`. A hit logs `arc_injection_tripwire` with the field name, pattern ID and turn ID, and no content. Behaviour does not change.
7. **Output validation.** zod on every function call and structured response. Unknown function names, extra fields or out-of-enum IDs fail the turn. `finishReason` `SAFETY` and `promptFeedback.blockReason` become a refusal (RAI-5).
8. **Answer checks.** Founder decision A3 (2026-11-23): Gemini writes the text of a typed data answer (`gemini-3.5-flash`, `asia-south1`, no tools declared, about $0.0087 per call, estimate). The writer sees only the dictionary's writer fields, never order-derived strings or image content. Its text must pass: zod (1 to 3 sentences, no markup), numeric fidelity (every number equals a same-turn tool value after the declared formatting), tools-only IDs (every ID was returned by a tool in this session), and wording rules reused from `risk-evidence-service.js` (no causal claims, no "measured", "actual" or "saved" for modeled values, no pass or fail verdict on model scores). A failure, safety block, truncation or writer error shows the template rendering, logs `arc_answer_fallback` with a reason code only, and makes no retry call. The template passes the same checks; if it fails, Arc shows "Arc could not check this answer against its sources." Labels are rendered by code.
9. **Approval protection.** No approve tool. `plan_lot` requires the recorded Confirm order and Confirm conditions presses. The approve route requires `reviewConfirmed: true` and the current revision fingerprint (ADR-0003). The turn route rejects any input whose action is approval.
10. **Cost limits.** Every Gemini call goes through the ADR-0004 budget API, with a per-session limit on typed turns.

## Consequences

- An injected order can at worst produce wrong field values. Those are shown as "Draft, not confirmed" and still need the human confirmations, the condition ranges and the approval. The `po-injection` suite tests this at every gate listed in spec 9.2.
- Because the tripwire only logs, an attacker cannot use it to block a lot, and false positives cost nothing. It gives the security reviewer a count to inspect.
- The approval-phrase rule handles common wording for free. Paraphrases reach the router, which has no approve function to call.
- A failed writer check shows the template instead of a retry, which protects the cap. The `grounding` and `numeric-fidelity` suites measure how often it happens and assert that every failed output falls back.
- Because the writer has no tools and sees no untrusted strings, text injected into an order cannot reach it through the answer path.
- Work needed: `safetySettings`, `systemInstruction` and mode `ANY` support in `vertex-gemini-client.js`, with the field names confirmed against the Vertex AI reference.

## Alternatives rejected

1. **Block or change the flow when the tripwire fires.** Easy to trigger with harmless text, gives attackers a lever, and the real control is structural.
2. **A second model call to judge each answer (critic).** Doubles attempts and uses a preview model (ADR-0001 item 4). The deterministic checks cover the pitch scope.
3. **Classifier first, rules second.** Spends an attempt on messages code can route for free, and lets a model decision run before the cheaper, stricter checks.
4. **Pass PO text into the router so it can answer questions about the order.** Puts untrusted text in the planning context. Order questions are answered from the validated fields.
5. **Template-only answers (no writer), as first drafted.** It removed one generative surface and one attempt per typed question. The founders chose written answers (A3, 2026-11-23); the checks in step 8 and the template fallback keep every shown number and ID grounded. Rejected by founder decision.
6. **Rely on default Vertex safety filters.** RAI-5 requires explicit settings so they are versioned and testable.
