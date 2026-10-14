# Om input and API contracts

These are the current application contracts, not a promise that an adapter is
configured or that a response has been verified against production data.
`GET /api/status` reports configuration, not connectivity. The application
does not expose a single authenticated dashboard BFF endpoint; do not call the
private Cloud Run service directly from browser JavaScript or expose identity
tokens there.

## Application routes

| Route | Purpose and input shape | Current acceptance boundary |
|---|---|---|
| `GET /health` | Process health | Does not prove dependency connectivity. |
| `GET /api/status` | Capability and runtime status | Configured is not live-verified. |
| `POST /orders/extract` | Multipart `file` (PDF/JPEG); optional operator context `orderId`, `paperType`, `paperSupplier`; optional selected line index | Requires the existing gated Storage, Vertex Gemini, and catalog path. No default local model call. |
| `GET /conditions/current?shift=DAY\|NIGHT` | Explicit operator shift | Requires configured BigQuery sensor adapter and an accepted stored reading. Never infer shift or synthesize readings. |
| `POST /risk/predict` | `{order:{itemCode,quantity,paperType,paperSupplier},conditions:{shift,ambientRhPct,ambientTempC,paperMoisturePct},levers}` | Uses parameterized `sql/predict.sql` when the risk gate is enabled; current model acceptance remains blocked. |
| `POST /risk/optimize` | `{order,conditions,levers}` with the application schemas | Requires the agreed optimizer objective and configured SQL adapter. Contract conflict is open. |
| `POST /risk/similar-runs` | `{order,conditions}` | Requires approved evidence SQL and configured historical query. |
| `POST /risk/explain` | `{order,conditions,prediction,optimization,evidence}` | Requires validated live prediction/optimization/evidence and configured explanation adapter. |
| `POST /jobs` | Reviewed PO reference, operator-confirmed line/item/quantity, validated analysis inputs, and idempotency key | Creates a DRAFT only when durable persistence and cross-instance idempotency are configured; otherwise fails closed. |
| `GET /jobs/:id` | Stored job ID | Retrieves a stored JobSheet only; there is no local mock record. |
| `POST /jobs/:id/approve` | Stored job ID and explicit supervisor approval action | Requires the configured persisted lifecycle. |
| `GET /jobs/:id/card.pdf` | Stored job ID | Returns the card for the stored approved job only. |
| `GET /impact/summary` | No caller-provided impact metrics | Four same-origin BigQuery queries when configured; held-out/simulated estimates are not measured factory outcomes. |
| `POST /job-sheets/render.pdf` | Caller-supplied schema-valid JobSheet | Local rendering only; does not persist, approve, or create a production job. |

All request bodies are schema-validated and strict where defined in
`src/schemas.js`. Error responses include explicit `VALIDATION_ERROR`,
`SERVICE_UNAVAILABLE`, `NOT_FOUND`, or conflict outcomes as applicable.
Consumers must not treat an unavailable response as an empty successful
result.

## Operator and service-owned inputs

- Gemini extraction is limited to PO identity/details and line item code and
  quantity; catalog specs are obtained through the catalog adapter.
- The operator supplies/validates purchase-order ID, loaded reel paper type,
  loaded reel supplier, selected line, item code, and quantity. These are not
  inferred from the PO specification.
- Om D5: there are no physical sensors. The UI marks any sensor reading as
  simulated, shows age and a stale note after 24 hours, and requires supervisor
  confirmation. Job preparation accepts explicitly confirmed manual values so
  an absent row never causes a fabricated reading.
- Prediction lever inputs and optimizer output must satisfy `LeversSchema`,
  `RiskResultSchema` and `OptimizationResultSchema`. Om D2–D3 approve the
  plan-relative objective, seven lever grids, slower-production allowances,
  ₹53.30/kg paper cost, and plant standards. Blank optimizer levers use the
  approved plant standard and are labeled as such.
- Prototype persistence uses BigQuery `prepagent.job_sheets` and process-local
  idempotency/rate limiting. There is no cross-instance idempotency guarantee;
  Cloud Run must remain capped at two instances for this contract.
- Similar-run evidence must remain explicitly historical evidence, not an
  order prediction. Explanation text is not proof of causation.
- The supervisor must review a persisted DRAFT before the approval endpoint;
  only the stored approved record may be used to retrieve its job card.

The authoritative machine/plant semantic decisions and required evidence are
tracked in [OM_DEPENDENCY_REGISTER.md](./OM_DEPENDENCY_REGISTER.md).
