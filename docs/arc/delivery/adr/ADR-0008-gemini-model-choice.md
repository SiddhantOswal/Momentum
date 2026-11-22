# ADR-0008: Gemini model and region per role

Status: Proposed
Date: 2026-11-23 (amended the same day for founder decision A3)
Author role: AI architect
Related: `05-ai-design.md` section 3; ADR-0004; `responsible-ai.md` RAI-5

## Context

- Only Gemini on Vertex AI may do generative work (competition rule; CLAUDE.md section 4).
- Served on project `prepagent-hack`, checked on 2026-11-22 with `countTokens`: `gemini-3.5-flash` and `gemini-3.5-flash-lite` in `asia-south1` and global. `gemini-3.8-flash`, `3.7-flash`, `3.6-flash`, `3.1-flash-lite`, `3.1-pro-preview`, `3-flash-preview` and `gemini-live-2.5-flash` are global only. The 2.5 family and any GA 3.x Pro are not served.
- The code runs `gemini-3.5-flash` in `asia-south1` (`config/gcp-vertex-ai.json`; `GEMINI_MODEL`, `VERTEX_LOCATION`).
- BigQuery, Firestore and Cloud Storage for Momentum are in `asia-south1`. The plant is in Pune.
- Prices on 2026-11-22, USD per 1M tokens (input / cached / output): 3.5-flash non-global 1.65 / 0.165 / 9.90; 3.5-flash-lite non-global 0.33 / 0.033 / 2.75; 3.1-flash-lite global 0.25 / 0.025 / 1.50; 3.8-flash and 3.7-flash global 0.75 / 0.075 / 3.75 until 31 December 2026, then 1.50 / 0.15 / 7.50; 3.1-pro-preview 2.00 / 0.20 / 12.00.
- One measured observation: the explanation prompt used 1,964 thinking tokens (`risk-evidence-service.js:521`). No other token counts are stored.

## Decision

| Role | Model | Region |
|---|---|---|
| Router and scope classifier | `gemini-3.5-flash-lite`; `gemini-3.5-flash` by config if lite misses the M1 eval thresholds | `asia-south1` |
| PO extraction | `gemini-3.5-flash` (unchanged) | `asia-south1` |
| Plan explanation | `gemini-3.5-flash` (unchanged) | `asia-south1` |
| Answer writer for typed data questions (founder decision A3) | `gemini-3.5-flash`, no tools, output limit 2,048; `gemini-3.5-flash-lite` as a config alternative | `asia-south1` |
| Photo diagnosis | `gemini-3.5-flash` (unchanged) | `asia-south1` |

- Model, region, output limit, thinking setting, temperature 0 and safety settings live per role in `config/arc-models.json`. Each stored generative result records the role's config version.
- Estimated cost per call: router $0.0018 (flash $0.0079), extraction $0.0116, explanation $0.0236 per attempt, photo $0.0093, answer writer $0.0087 (flash-lite $0.0022). A typed data question costs about $0.0105 and 2 attempts. Estimated cost per J1 lot: $0.035 with buttons only, $0.059 with one explanation retry, $0.19 at every output limit; $0.049 with 2 typed condition entries and 1 typed data question. None of these is measured; M2 measures tokens, latency and attempts per role from `usageMetadata` and the task-run record.
- The GA status of `gemini-3.5-flash-lite` is confirmed on the Vertex model page before the M1 build. If it is preview, the router uses `gemini-3.5-flash`.

## Consequences

- Prompts, orders, photos and results stay in one region with the rest of Momentum's data.
- Flash-lite saves about $0.006 per typed message. Over a 300-attempt day that is under $2, so the main reason is latency (estimated 1 to 2 s against 2 to 4 s), not cost.
- No change to the three generative paths that already pass their tests.
- Risk: flash-lite may misclassify more off-topic messages. The `off-topic` and `scope-refusal` suites compare both models in M1, and the config switch costs nothing to flip.
- Price risk: regional rates are 10% above global. Accepted.

## Alternatives rejected

1. **`gemini-3.8-flash` or `3.7-flash` (global, promotional price).** About half the 3.5-flash output price until 31 December, but global-only processing gives up the single-region posture, and the price doubles after the promotion. The savings at demo volume are cents a day.
2. **`gemini-3.1-flash-lite` (global) for the router.** Cheaper than 3.5-flash-lite, but global only.
3. **`gemini-3.1-pro-preview` for explanations or as a critic.** Preview, global only, the most expensive option, and a critic doubles attempts per answer (ADR-0001 item 4).
4. **`gemini-3-flash-preview`.** Preview and global only.
5. **One model for every role (3.5-flash for the router).** Simpler, and kept as the fallback. Rejected as the default only on latency, pending M1 evals.
6. **`gemini-live-2.5-flash` for voice.** Voice is disabled until a voice backend exists (spec 1.2).
