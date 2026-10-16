# Approach B — hackathon authorization

The selected hackathon policy uses signed temporary session capabilities. It does **not** establish verified human identity. Firebase supervisor authentication remains a separate production configuration, not the selected hackathon sign-in flow.

## Runtime requirements

`USTAAD_AUTHORIZATION_MODE=HACKATHON_DEMO` selects this policy and excludes offline mock adapters. Required settings include the existing approved-input restriction (`USTAAD_SYNTHETIC_ONLY=true`, a legacy internal identifier), approval audit and a cryptographically random 32-byte signing secret encoded as 64 lowercase hex characters. The secret is shared securely across instances; there is no default or checked-in key. Do not expose it in logs, chat or Git.

These flags do not grant cloud permissions or authorize model calls. Existing model acceptance, optimizer contracts, TEST-write boundaries, shared Gemini counter and runtime IAM still apply.

## Session and operation checks

`POST /api/auth/demo-session` requires the actual allowed Origin and rate limiter. It issues/reuses a host-only `__Host-ustaad-demo` cookie: Secure, HttpOnly, SameSite Strict, Path `/`, no Domain. The server verifies HMAC-SHA256, policy, issue time and two-hour expiry. HTTPS is required for the deployed service. Browser-supplied UID, email, role and forged identity headers do not grant authority. Rotating the signing key invalidates sessions.

A principal uses `uid=demo:<random-session-id>`, `provider=server-signed-demo-session`, role `hackathon-participant`. It cannot masquerade as a verified Firebase human. Approval audit must record these semantics accurately.

Job identity is `JOB-HACK-<32-hex-session-id>-<40-hex-request-hash>`. The server derives it from the session and request. Same-session replay uses the existing idempotency contract; changed payload conflicts. Another participant's record is rejected before accessing protected adapters. Job reads, approval, cards and feedback enforce ownership independently of browser controls.

## Persistence and limitations

Approval requires a valid owned draft, permitted transition and audit. The repository and card service validate the trusted scoped principal; a browser confirmation is not a verified human UID. TEST-order restrictions remain enforced.

Job request coordination and trace ownership are process-local. Cross-instance distributed exactly-once behavior is **not** guaranteed; BigQuery has no general unique-row constraint. Restarted/evicted trace ownership fails closed. Do not describe a local trace as durable decision memory.

## Photos and public boundary

Only ten approved opaque photo IDs can be listed/classified. Selection makes no model call; classification is a deliberate shared-metered Gemini action. Arbitrary image uploads, object-path disclosure and a browser image-preview endpoint are not part of the approved API. Prior 7/10 folder-label matches do not establish calibrated factory QA accuracy.

Cloud Run became publicly invokable on 16 October 2026 under explicit owner release authorization. Application session, ownership, Origin and TEST-only controls remain active; public infrastructure invocation does not grant unrestricted application authority. The anonymized read-only Impact view is distinct from privileged mutations. Do not bypass Origin or session checks to make a localhost proxy behave like the deployed origin. Public judging access must not expose unrestricted paid execution, arbitrary records or administrative provisioning.

Model acceptance comes only from `config/model-acceptance.json`: the source records owner decision D4-2026-10-16-OM, plus the explicit project-owner exception approval. The private v7 reference workflow was exercised; v8 presentation/read-back verification is recorded in release provenance. Original strict evidence remains incomplete. This policy does not create a model-acceptance bypass. See the [final acceptance runbook](FINAL_PO_TO_CARD_ACCEPTANCE.md).
