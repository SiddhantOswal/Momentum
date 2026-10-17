# Momentum

**Production intelligence for corrugated manufacturing.** Momentum turns an approved purchase order into a reviewed setup recommendation and supervisor-approved production card, combining Gemini, BigQuery ML and constrained optimization.

[Open the application](https://momentum-514663464609.asia-south1.run.app) · [Local setup and testing](docs/README.md) · [Approved PO fixtures](public/samples/)

## How it works

```mermaid
flowchart LR
    A[Purchase order] --> B[Gemini extraction]
    B --> C[Catalog validation]
    C --> D[Operator confirms conditions]
    D --> E[Five defect-risk estimates]
    E --> F[Constrained setting optimization]
    F --> G[Grounded explanation]
    G --> H[Draft JobSheet]
    H --> I[Supervisor approval]
    I --> J[Stored PDF job card]
```

Gemini extracts and explains. Validated application tools and BigQuery perform catalog checks, prediction, optimization and persistence. A supervisor retains the approval decision; the system does not control machinery.

## Verified reference case

For PKBX0041, the recorded optimizer acceptance compared a **100.4 kg / ₹5,351** baseline with an **83.0 kg / ₹4,426** recommended result: **17.4 kg and ₹925 estimated reduction**. This is a model-based result for that evaluated case, not measured factory savings or a general performance guarantee. The private end-to-end acceptance also independently read back the JobSheet, approval audit and matching stored PDF.

## Product areas

| Area | Capability |
|---|---|
| **New Lot** | Approved PO intake, extraction review, confirmed conditions, risk estimates, optimized settings, explanation, approval and stored card |
| **Defect Intelligence** | BigQuery historical cases, comparable operating-condition groups, detailed evidence and operator notes |
| **Photo Diagnosis** | Gemini classification of the ten approved photos; selecting a photo does not itself make a provider call |
| **Production Impact** | Held-out simulation estimates with source context; no annualized or measured-savings claims |

## Run locally

Requires Node.js 22, npm and repository access.

```sh
git clone https://github.com/SiddhantOswal/Momentum.git
cd Momentum
npm ci
npm run preview:local
```

Open `http://localhost:4173`. The ordinary preview shows honest empty states and does not invoke paid cloud services. `npm run demo:local` starts a separate, clearly labeled offline mock backup; its output is not live-cloud evidence. Setup, testing, approved fixture details and current operating boundaries are in the [repository guide](docs/README.md).

## Cloud and safety

Cloud Run hosts the application in `asia-south1`. Vertex AI Gemini handles extraction, explanations and photo classification. BigQuery / BigQuery ML supports catalog/history, prediction, optimization and JobSheet persistence. Cloud Storage stores approved inputs and cards. Firestore provides the shared Gemini attempt counter.

- Cloud Run maximum: **2 instances**. Gemini limit: **100 attempted calls per Asia/Kolkata day**; failed or ambiguous attempts count.
- TEST-only writes, approved-input allowlists, request-size validation, session ownership and same-origin mutation checks.
- Model acceptance, operator confirmation and approval audit are enforced. Firebase remains separate from the selected Approach B workflow.
- The existing **₹5,000 budget alert** is an alert, not a hard spending cap.

## Validation, Reliability & Responsible AI

Momentum is designed as a supervised industrial intelligence platform, combining real manufacturing context, predictive models, controlled recommendations and human oversight.

- **Industry-grounded foundation:** Built on a real 117-item manufacturing catalog, supplemented by modeled production history and operator-confirmed conditions. Factory-level accuracy and realized savings remain subject to field validation.

- **Transparent model evaluation:** Five predictive models support pre-production risk assessment. Independent evaluation across 219 September lots identified performance differences, including lower confidence for crack predictions during monsoon conditions. These limitations are documented and recommendations remain subject to supervisor approval.

- **Controlled execution and traceability:** Production inputs, recommendations and approval decisions follow a structured review workflow. Approved job records and PDF cards are durably stored, while temporary coordination and purchase-order review state remain instance-local.

- **Evidence-based visual assessment:** Historical photo evaluation matched 7 of 10 approved reference images, establishing an initial demonstration baseline rather than a claim of production-grade inspection accuracy. Learning from completed production lots is planned beyond V1.

**Our approach:** Prioritize explainability, human accountability and measurable validation as Momentum evolves toward broader industrial deployment.
