# Synthetic purchase orders (test fixtures)

All 5 are synthetic: fictional clients, numbers and prices, using real item codes from `prepagent.items`.
Each carries a "SYNTHETIC DEMO DOCUMENT" footer. Approved for live extraction tests and for the demo.
Extraction reads only **item code + quantity** (plus PO number and delivery date); the spec comes from `prepagent.items`.
Paper type, supplier, shift and machine settings are always entered by the operator.

| File | What it tests | Lines (code → qty) | Expected app behaviour |
|---|---|---|---|
| `PO1_ClientA_single_B1047.pdf` | **Demo hero order**, one clean line | PKBX0041 → 1300 | MATCHED → spec for B1047 (5-ply BC, 410×305×255) |
| `PO2_ClientA_multiline.pdf` | Several lines on one PO | PKBX0089 → 6000, PKBX0092 → 800, PKBX0026 → 1200 | All 3 MATCHED; the UI lets the supervisor pick which line to plan |
| `PO3_ClientP_electronics_with_fitment.pdf` | Different client, includes a die-cut fitment | BXCR100E → 1500, BXCR101E → 1200, FITM120E → 2500 | All 3 MATCHED (FITM120E is DIECUT) |
| `PO4_ClientQ_ambiguous_set.pdf` | Code that maps to two parts | PKBX0242 → 400, PKBX0248 → 600 | PKBX0242 = AMBIGUOUS, candidates PKBX0242-TOPS / PKBX0242-BOTS → ask the supervisor; PKBX0248 MATCHED |
| `PO5_ClientB_scanned.jpg` | Scanned photo (slightly tilted), unknown code, missing quantity | PKBX0119 → 900, PKBX0999 → 500, PKBX0120 → (blank) | PKBX0119 MATCHED; PKBX0999 = UNKNOWN_CODE (not in master); PKBX0120 = MISSING_QTY ("To be confirmed") → ask, never guess |

Exact expected output per line is in `expected_results.json`
(`itemCode`, `quantity`, `status`, `resolvedItemCode`, `candidates`).

Acceptance: item codes and quantities match exactly; PO number matches; no line has an invented quantity or spec.
