# Ustaad AI — Corrugated Production-Prep Agent

This repository contains the JavaScript/Hono local application and the
blueprint-aligned Zod contracts for the Ustaad AI prototype. It is **not** a
completed cloud-connected agent: Gemini, BigQuery/BigQuery ML, Cloud Storage,
Translation, Pub/Sub, Dataflow, Cloud Run, and the operator production workflow
are not configured as live application services.

## Run locally

Requirements: Node.js 20 or newer and npm.

```sh
cd prepagent
npm install
npm start
```

Open <http://localhost:8080>. Set `PORT` to use another port:

```sh
PORT=8081 npm start
```

The local UI and `/api/status` identify the development mode. JSON agent
endpoints validate caller-provided data; requests that require cloud-backed
results return `503 SERVICE_UNAVAILABLE` rather than fabricated production
predictions.

See [docs/LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md) for the local
routes and test instructions, and
[docs/CLOUD_INTEGRATION_TODO.md](./docs/CLOUD_INTEGRATION_TODO.md) for the
verified Part 2 gaps and external dependencies.

## Tests

```sh
npm test
```

Tests run locally and do not require Google Cloud credentials.
