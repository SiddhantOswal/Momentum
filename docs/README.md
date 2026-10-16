# Documentation index

The root [README](../README.md) is the starting point for a fresh clone. Historical reports below retain the evidence and decisions at their original dates; they do not automatically describe the newest local source or authorize cloud changes.

## Current setup and product review

- [Local development](LOCAL_DEVELOPMENT.md): no-data preview, explicit backup, credentials and private-cloud limits.
- [Repository hygiene review](REPOSITORY_HYGIENE_REVIEW.md): retained/removed material, portability and verification.
- [Premium analytics redesign](PREMIUM_ANALYTICS_UX_REDESIGN.md): exact data mappings, screenshots, live acceptance and later local empty-state correction.
- [Curated evidence](evidence/README.md): reviewed screenshots and safe release summary; raw operational journals stay local.
- [Data provenance clarification](DATA_PROVENANCE_CLARIFICATION.md): owner-approved data and honest simulation/prediction distinctions.

## Decisions, security and model gates

- [Om decisions](OM_DECISIONS.md) and [dependency register](OM_DEPENDENCY_REGISTER.md).
- [Approach B authorization](HACKATHON_DEMO_AUTHORIZATION.md). Firebase remains separate; [Firebase setup](FIREBASE_AUTH_SETUP.md) is not the selected hackathon login policy.
- [D4 evidence ingestion](D4_EVIDENCE_INGESTION.md) and [bounded evaluation proposal](MODEL_EVALUATION_APPROVAL_PROPOSAL.md). Proposed SQL is not permission to execute it.
- [Production readiness audit](PRODUCTION_READINESS_AUDIT.md), [P0 reconciliation](P0_CLOSURE_RECONCILIATION.md), [completion tracker](PART2_COMPLETION_TRACKER.md).

## Release, demo and actual acceptance

- [Release provenance](RELEASE_PROVENANCE.md).
- [Final PO-to-card acceptance](FINAL_PO_TO_CARD_ACCEPTANCE.md).
- [Demo readiness](DEMO_READINESS.md) and [V1 freeze rules](V1_CODE_FREEZE.md).
- [GCP acceptance report](GCP_END_TO_END_ACCEPTANCE_REPORT.md), [live evidence journal](LIVE_GCP_EXECUTION_EVIDENCE.md), [demo rehearsal](LIVE_GCP_DEMO_REHEARSAL.md).
- [Official requirements](HACKATHON_OFFICIAL_REQUIREMENTS_2026.md), [requirements mapping](REQUIREMENTS_TO_CODE_AND_GCP_MATRIX.md).
- [Committee review](COMMITTEE_FINAL_JUDGMENT.md) and [internal scorecard](AI_BUILDER_CUP_FINAL_SCORECARD.md); neither is an official competition result.

## Retained history

The `STAGE_A*`, `STAGE_B*`, `FRONTEND_*`, `ARC_UI_RESEARCH`, `SHARED_DASHBOARD_*`, prior Defect Intelligence, cloud TODO, authorization-package and consolidation documents preserve earlier decisions, failures and acceptance scope. They are intentionally retained as engineering history, not runtime dependencies. Older raw-artifact paths may identify private local records rather than files shipped in a clone. Consult current setup and provenance before following an old command.

Application runtime does not load this documentation, operational evidence or the proposed evaluation SQL. The Docker context excludes them.
