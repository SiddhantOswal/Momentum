# Approach B — isolated hackathon authorization policy

Owner decision: final no-login hackathon access decision, explicitly amending scope A, 15 October 2026. This supersedes mandatory human Firebase sign-in for the hackathon path. It does not authorize deployment, public IAM, paid calls, runtime configuration changes, or a model-acceptance bypass.

## One workflow, two explicit authorization configurations

`USTAAD_AUTHORIZATION_MODE=HACKATHON_DEMO` selects temporary server-signed participant capabilities. Absent this exact value, the existing Firebase Google supervisor role, exact UID allowlist and revocation-verifying policy remain unchanged. This is independent of the offline mock execution flag: hackathon mode excludes mock adapters even outside Cloud Run.

Required hackathon configuration (prepared only; not applied):

- `USTAAD_SYNTHETIC_ONLY=true`
- `USTAAD_ENABLE_APPROVAL_AUDIT=true`
- `USTAAD_DEMO_SESSION_SIGNING_KEY`: cryptographically random 32-byte secret encoded as 64 lowercase hex characters, identical across instances. No default, no checked-in value, no browser exposure. Provision securely during an independently approved release. Rotation invalidates outstanding sessions; do not send the key in chat.
- Existing explicitly approved service configuration, accepted model evidence, approved optimizer contract, shared Firestore cap and TEST-write restrictions remain required. These flags grant no cloud permissions or provider approval.

`POST /api/auth/demo-session` requires a same-origin Origin and the existing server request limiter. It issues/reuses a host-only `__Host-ustaad-demo` cookie: Secure, HttpOnly, SameSite Strict, Path `/`, no Domain. Server verifies HMAC-SHA256, exact policy, issue time and two-hour expiry. No user identity headers or browser-supplied UID/role are accepted. This cookie is a temporary bearer capability, not an authenticated human identity. HTTPS is required for release; local loopback HTTP is used only in isolated tests.

Each principal has `uid=demo:<random-session-id>`, `provider=server-signed-demo-session`, role `hackathon-participant`. It cannot pass the Firebase verified-principal predicate. No Firebase user, UID, claim or account is fabricated.

## Record boundaries and persistence

Job identity is `JOB-HACK-<32-hex-session-id>-<40-hex-request-hash>`. Server derives this namespace and the idempotency key from the verified session; clients cannot choose it. The existing idempotent submission contract validates the namespace and hash. Different participants submitting identical bytes/keys get different jobs. The same participant's same key/request replays; changed payload conflicts. Process-local idempotency remains the approved D6 limitation, not distributed exactly-once.

All JobSheet reads, approval, card retrieval and linked feedback routes reject another session's or legacy record IDs before accessing adapters. Card service and repository approval independently require a privately branded, job-scoped principal. Demo principals cannot use non-audited card/repository instances. Existing TEST-order checks remain. The global insights route is withheld from demo sessions; the anonymized cached impact endpoint remains available. Trace IDs are session-scoped in a bounded process-local owner map; missing/restarted/evicted trace ownership fails closed.

Approval uses the same DRAFT → APPROVED repository update, GCS PDF, reconciliation, cleanup, independent read-back and replay logic. Existing `approval_audit_json` gains optional, backward-compatible demo fields; no extra table/column/migration is needed:

- `actorUid=demo:<session-id>` (generic actor identifier in the existing field, **not** a Firebase UID)
- `actorType=HACKATHON_DEMO_PARTICIPANT`
- `authorizationMode=HACKATHON_DEMO`
- `identityProvider=server-signed-demo-session`
- `authenticatedHuman=false`

Schema requires the complete matching demo provenance and job namespace together, with the existing server timestamp, correlation/decision IDs and card URI. Stored card rendering uses the same PDF renderer and includes the demonstration approval disclaimer for session-scoped records.

## UI after confirmed handoff

The existing authentication client now branches on server-advertised mode. It starts a session automatically, keeps the cookie out of JavaScript, hides Google sign-in in hackathon mode, and uses the existing fetch/trace path. No failed operation/provider request is automatically replayed. On expiry it explains that a new session cannot access the old session's records. Participants must keep their browser session; there is no account-based recovery in V1.

The same approval form, confirmation dialog, backend endpoint and stored PDF experience apply to every participant. The exact owner note appears adjacent to approval:

> Hackathon Demonstration Mode: Supervisor approval is available to all participants for demonstration purposes. In production, approval is restricted to authorised supervisors.

The UI shows synthetic/manual provenance, stale simulated readings and held-out/simulated impact caveats in this explicitly selected mode. Mock/offline provider results remain rejected. The existing production display policy remains unchanged outside this mode. An approved PO1 download is supplied; arbitrary upload hashes remain rejected server-side. A TEST-order-ID hint avoids implying that real-order writes are allowed.

## Remaining release gates

This is source implementation and local evidence, not an active public service. Complete version-linked model evaluation evidence/review is still missing; live model-dependent actions remain blocked. A shared signing secret, approved configuration/source snapshot, private candidate deployment, runtime-identity integration checks and separately approved paid synthetic acceptance are still required. Firebase Console registration is optional for this hackathon policy, still needed for future production-supervisor acceptance. No production-readiness claim follows from this mode.

Limits retain their actual scopes: existing per-IP in-memory request limiter and D6 idempotency/trace state are process-local; Firestore Gemini reservations are shared when enabled, fail closed, and are not a monetary hard cap. BigQuery limits bound each query, not total spend. Public proxy behavior and runtime counter access require candidate acceptance. No distributed exactly-once, genuine factory telemetry or measured savings is claimed.


## Private activation and approved-photo boundary — 15 October 2026

Shared signing key is now pinned to Secret Manager version1 on private candidate `prepagent-b-1015-43c1a259`; production Firebase policy remains retained/inactive for hackathon sessions. Strict HTTPS public-origin configuration accounts for Cloud Run TLS termination. Defaulttraffic/privateIAM unchanged. All runtime inputs are identified by V4source manifest; see finalcloudacceptancereport.

The same DefectCheck screen now exposes only authenticated/scoped `GET /evidence/approved-photos` and `POST /evidence/classify-photo` for ten fixed opaquephotoIds. An explicit featureflag plus HACKATHON_DEMO/synthetic-only configuration is required. These owner-consented **real demo/testing photos** are the sole approved non-synthetic-media exception; they are not factory telemetry, syntheticPOprovenance or evidence of calibrated risk-model acceptance. Arbitraryimage/PDFuploads remain disabled; exactGCSgeneration/size/SHA/JPEGbounds enforced. No rawphoto, clientbranding, objectpath or expectedlabel is exposed by the endpoint. Gemini calls are centrallymetered and do not authorize model-dependentJobSheets.

Exactly10photos were classified once;7matched folderlabels. Failedclassificationswere not replaced with expectedlabels. Dailycounter18=3priorcountertests+15newproviderattempts. No more calls are authorized under this run's allowance. Realapproval/persistedPDF acceptance remains blocked by model-evidence gate, not by a fabricated identity or mandatoryFirebase sign-in.
