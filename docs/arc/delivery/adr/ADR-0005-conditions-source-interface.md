# ADR-0005: Conditions source interface with provenance

Status: Proposed
Date: 2026-11-23 (amended the same day for the M0 gate, round 1)
Author role: solutions architect
Branch: `arc/m0-discovery`
Design: `04-technical-design.md` section 6

## Context

- The models read ambient humidity, ambient temperature and paper moisture. No plant sensor exists. The Pub/Sub topic `sensor-readings` has no subscription, and `sensor_readings` holds one simulated row from 14 October (data audit section 5).
- `createConditionGuard` (`src/condition-guard.js`) resolves humidity and temperature as plant value, then weather, then seasonal median. Moisture has no fallback. It records a source only for values it fills itself, so a weather value sent by a client is stored as `plant` (spec C20).
- The founders confirmed Pune and the Maps Platform Weather API, labelled "public weather record, not a plant sensor". They also decided that 7.3% moisture is pre-filled as an editable example.
- No weather reading is stored, so an answer cannot be traced after the 10-minute cache (data audit P1). Conditions are not stored before `POST /jobs` (P2).
- `GET /conditions/current` returns the five-week-old simulated row and must not answer "today" (data audit finding 4).
- CLAUDE.md section 3: every value needs a source and a label, and modeled, sample, simulated and weather values must stay distinct.

## Decision

1. Define `ConditionsSource` with `id`, `fields` and `read({ lotId, runDate, shift, signal })`. Source IDs equal the provenance value each source writes: `operator_entry`, `synthetic_example`, `public_weather_record`, `dataset_seasonal` and `plant_sensor`. `read` returns `ProvenancedValue` records (field, value, unit, provenance, source detail, label, observation ID and time, role, confirmed). The schema requires `observationId` and `observedAt` for `public_weather_record` and forbids them otherwise (design 2.7). Labels are set in code from the chip list in spec section 5, never by the model.
2. Implementations for the pitch:
   - `OperatorEntrySource`: draft conditions on `lot_heads`.
   - `ExampleValueSource`: 7.3% moisture, from one config constant, labelled "Example value, not measured". It is never a default for a blank field.
   - `PuneWeatherSource`: reads through the shared cache and writes each reading to `weather_observations`.
   - `DatasetSeasonalSource`: `seasonalValue` over `config/condition-ranges.json`.
3. Future `PlantSensorSource`: reads the Pub/Sub to BigQuery route once it exists, rejects readings older than 15 minutes, and maps `source = simulated` to `simulated_sensor`. Simulated values are never used for planning. Not built now.
4. Storage: P1 becomes Firestore `weather_observations` plus `weather_cache/pune`. P2 becomes `lot_heads.draftConditions` and a frozen copy on each `lot_revisions` document. The guard keeps its resolution order and stores the full list as `conditionProvenance` on the JobSheet, next to the existing `conditionSources`.
5. C20: a client may label a value as weather only by sending an `observationId`, and the value must be the server's own cached reading. The server accepts the label only if the observation is in `weather_observations` (server-written only), is the current or previous entry of `weather_cache/pune`, is less than 60 minutes old, and its stored value equals the value sent. The stored value is always the observation's. Otherwise the value is stored as operator entry. An edited weather value is operator entry.
6. Behind `USTAAD_ENABLE_CONDITION_PROVENANCE`.

## Consequences

- Every condition Arc or the dashboard shows has a stored source that can be traced afterwards (O7, O8, AC1.19, AC3.1, AC3.2).
- A sensor feed can be added as one more source, without changing Arc or the guard's callers.
- The weather API is called at most 144 times a day from all instances together. Today, every plan with a missing value also calls it, uncached.
- About 144 weather documents a day, at most, expiring after 90 days. Cost about ₹0 in Firestore. The Weather API price per call is to be confirmed in Maps Platform pricing.
- **Domain sign-off is needed before the demo** shows these as anything beyond labelled examples. Om has to confirm outdoor Pune weather as a stand-in for plant-floor ambient, and 7.3% as a realistic example. The modeled history pairs 7.3% with December to February; the November median is 8.72%.
- **Failure modes:** weather down or out of range means the fields show "Required", or the guard uses the seasonal value with its own label. Firestore down blocks saving conditions (fail closed).
- **Rollback:** switch off the flag. The guard behaves as today and `conditionSources` stays as it is now.

## Alternatives rejected

1. **BigQuery tables `arc_weather_observations` and `arc_lot_conditions`** (the data audit's concrete shape). Rejected for live state. Conditions in progress need transactional updates together with the lot head. BigQuery DML is slow and not transactional across tables, and streamed rows have a delay before DML can touch them. An append-only BigQuery export can be added later for analytics.
2. **Use `GET /conditions/current` (stored readings) as a source.** Rejected. It returns a stale simulated row as if current.
3. **Simulated sensor stream (data audit P6).** Rejected for the pitch, as the data audit recommends. It adds a third label for the same field without adding information.
4. **Let the model fill conditions from text.** Rejected as a source. Typed values are parsed into form fields and stored as operator entry, after the user sees them (spec section 2). The model never produces a weather or moisture value itself.
