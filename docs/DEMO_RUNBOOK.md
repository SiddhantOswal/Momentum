# Judge/demo runbook

## Current decision

**Do not present the current application as a completed live end-to-end demo.**
The composed PO1 workflow test is offline and uses fake adapters and
in-memory lifecycle fakes. Historical Cloud Run checks do not establish the
current source revision or a fresh complete workflow. Live model, optimizer,
genuine sensor, durable job lifecycle, and source-pinned release acceptance
remain open.

## Safe local orientation

From the app repository:

```sh
npm start
```

Open the URL printed by the process (default `http://localhost:8080`). Confirm
`GET /health` and `GET /api/status`. The status response is configuration
only. Keep integrations disabled unless operation-specific authorization and
required inputs are available. The local UI must show unavailable services as
unavailable; do not substitute synthetic production outcomes.

Run deterministic local acceptance sequentially:

```sh
npm run test:acceptance
npm test
```

Do not run these two port-sharing suites concurrently. Passing tests establish
offline contract behavior, not cloud connectivity or production acceptance.

## Private live path (not currently accepted)

The recorded Cloud Run service is private. A dashboard must use an
authenticated server-side proxy/BFF and must never put service-account or
identity tokens in browser code. No verified Om-owned BFF endpoint is recorded
here. Do not make the service public.

Before a live judge run, obtain operation-specific approval for the exact PO
upload, paid model/query calls, sensor read, durable job write, supervisor
approval, and job-card retrieval. Confirm accepted PO and expected results,
optimizer semantics, model acceptance, genuine current conditions and freshness,
and existing runtime identity/permissions. Use only the repository deployment
mechanism after clean source provenance is established. Do not create
resources, change IAM, change traffic, or deploy as part of this runbook.

## Required live sequence and evidence

1. Record the exact build digest, revision, private service URL, project,
   region, runtime identity, and configuration.
2. Check health and version; record timestamp and authenticated access path.
3. Upload only the approved test PO through `/orders/extract`; capture
   extraction, catalog match and operator review.
4. Load actual conditions and retain source, identity and freshness evidence;
   require explicit shift confirmation.
5. Capture successful prediction, optimization, similar-run and explanation
   responses, including request/response IDs and approved objective version.
6. Create a DRAFT using the reviewed line and idempotency key; retrieve that
   same stored record.
7. Obtain explicit supervisor approval; retrieve the approved record and its
   job-card PDF. Confirm every stage refers to the same job ID.
8. Confirm unavailable integrations fail honestly, instance maximum is two,
   and the service remains private. Record evidence in
   [LIVE_INTEGRATION_EVIDENCE.md](./LIVE_INTEGRATION_EVIDENCE.md).

Until every stage above has fresh evidence, call the run partial and do not
claim production readiness or a verified PO-to-card workflow.
