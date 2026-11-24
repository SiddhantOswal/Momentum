# ADR-0009: Grounded query layer over a metric dictionary

Status: Proposed
Date: 2026-11-23 (amended the same day for founder decision A3)
Author role: AI architect
Related: `05-ai-design.md` section 4; `data/data-audit.md` sections 6 and 7; ADR-0003, ADR-0005

## Context

- Arc answers data questions (J2, J3, J4, J7) and must show only numbers that match a stored source, each with one provenance label (O7, O8), and say exactly what is missing when the data cannot answer (O6).
- The data audit lists 19 questions: 8 answerable today, 7 partly answerable and 4 not answerable. No table has a provenance column. Modeled history ends on 30 September 2026. `GET /conditions/current` returns a five-week-old simulated row, and `getInsights` is not configured in production.
- The Insights spec (21 November) prefers the BigQuery Conversational Analytics API data agent, with "Fallback A": deterministic parameterised queries chosen by Gemini function calling, with no model-written SQL. The founder brief requires no model-written SQL.
- V5 `contracts/metric-dictionary.json` defines metric entries with unit, computation kind, limitation and null policy.

## Decision

1. One read-only tool, `query_metric({ metric, filters })`. `metric` is an enum of IDs from `config/arc-metrics.json`. `filters` is a strict schema per metric (for example `defect` from the five labels, `ambientRhPct` within 25 to 98, `month` within the data's range).
2. Each dictionary entry holds: ID, version, source (an existing command such as `getImpactSummary`, `modelAcceptance`, `findSeenBefore`, or a named file in `sql/arc/`), parameter schema, unit and rounding, provenance label (spec section 5 chips), `enabled`, and when disabled the exact `missing` text. Entries follow the V5 dictionary fields where they apply.
3. SQL lives in `sql/arc/*.sql` with named parameters and reads only the views proposed in the data audit (P3 `v_arc_job_cards`, P4 `v_arc_lot_history`, P5 `v_arc_feedback`), each adding a provenance column. Views and their creation are tickets with their own change record; nothing here creates them.
4. Every query runs with `maximumBytesBilled` of 50 MiB and a row limit. Table and column names are static in the SQL files; only values are parameters.
5. Insufficient data is decided in code: a disabled metric, an empty result, or a filter outside the data's range returns the "insufficient data" card with the dictionary's `missing` text and the labelled alternatives (spec J4). Measured scrap, measured scrap reductions, sensor readings and throughput start disabled. A plan's scrap or cost figure is a model estimate and is described as a model-estimated reduction, never as a saving.
6. Each entry lists its writer fields: the values, units, labels and IDs the answer writer may see. Order-derived strings are never writer fields.
7. Founder decision A3 (2026-11-23): for a typed question that returned data, Gemini (`gemini-3.5-flash`, `asia-south1`, about $0.0087 per call, estimate) writes 1 to 3 sentences from the writer fields. Every number in that text and on the card must equal a value in the same turn's tool results after the entry's unit formatting, and every ID must be tool-returned (ADR-0010). On failure the template rendering is shown. Labels come from the entry or from the command response and are rendered by code, never taken from model text.
8. Insufficient-data answers are not written by the model. They use the dictionary's `missing` text, so O6 does not depend on generation.
9. Arc never routes "moisture today" to `GET /conditions/current`. Conditions come from the lot record (ADR-0003) and the weather tool (ADR-0005).

## Consequences

- Arc answers a fixed set of question families. Questions outside them go to `ask_clarification` or "insufficient data". This is narrower than a data agent and every answer can be reproduced from its query and parameters.
- Each new question family is a dictionary entry, a SQL file and eval cases, reviewed like code.
- The same dictionary can back an Insights "Ask" box later, so Arc and Insights return the same answer for the same question.
- A typed data question costs 2 Gemini attempts (router and writer), about $0.0105 (estimate). Picked suggestions stay templated at 0 attempts.
- Cost per query is bounded by the byte cap. The pitch set reads at most a few MiB per query (estimate; measured in M2).
- Dependency: until views P3 to P5 exist, the metrics that need them stay disabled and answer "insufficient data", naming the missing record.

## Alternatives rejected

1. **BigQuery Conversational Analytics API data agent.** It can generate SQL when no verified query matches, which the founder brief rules out. It adds IAM, a new API surface and its own audit gap (the Insights spec notes that conversation logs do not record every generated SQL step). Revisit after the pitch, behind the same dictionary and the same checks.
2. **Gemini writes SQL, checked by a parser before it runs.** Post-hoc SQL checking is a weak boundary, and it puts arithmetic in the model's hands.
3. **Answer from the model's general knowledge with retrieved rows in context.** Numbers can drift from rows, and labels would come from model text.
4. **Template-only answers, with no model-written text.** Proposed in this ADR's first draft: every number would be correct by construction, at one attempt per typed question. The founders chose written answers (A3, 2026-11-23) because typed questions get plain-language replies, and the numeric and ID checks with the template fallback keep the shown numbers grounded. Rejected by founder decision; the template remains the fallback.
5. **Use `GET /insights/summary`.** Its adapter is not configured in production, and its owner and intended state are unknown (STATUS).

## Amendment (2026-11-24, ARC-M4-01)

- The metrics `defect_history_at_humidity` and `top_scrap_items` read `prepagent.lots` directly, as the existing dashboard SQL does. They move to the views P4 and P5 once ARC-M4-02 creates them.
- `ambientRhPct` is accepted from 0 to 100, not 25 to 98 as decision 1 said. The wider range is bounded and harmless; a humidity with no nearby lots returns "insufficient data".
- `query_metric` `defect_history_at_humidity` is the Arc answer path for defect history. `search_defect_history` stays for the dashboard and the photo "seen before" panel. Both use the humidity band in `src/humidity-band.js` (10 points).
