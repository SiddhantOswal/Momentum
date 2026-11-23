# ADR-0006: Reproducible deploy and demo-day scaling

Status: Proposed
Date: 2026-11-23 (amended the same day for the M0 gate, round 1)
Author role: solutions architect
Original branch: `arc/m0-discovery` (now on `arc/main`)
Design: `04-technical-design.md` sections 5.6, 5.7 and 7

## Context

- No deploy command exists in the repository. Scaling, concurrency, affinity and the 31 env vars (2 from Secret Manager) exist only on the live service (design E3).
- The `Dockerfile` does not build `web/`, and `public/app/` is gitignored. The React bundle in an image therefore comes from a local build at build time. `ops/cloudbuild-private.yaml` builds and smoke-tests an image but does not check `/app` and does not deploy.
- The limits change on 22 November followed a good manual pattern: tagged no-traffic revision, then `tools/release-preflight.mjs`, then traffic shift, keeping the old revision. It was typed by hand.
- On 20 November, 64 requests got platform 429s ("waiting too long for an available instance") at max 2 instances (design E1). `momentum` scales to zero with startup CPU boost off, so the first request after idle is a cold start.
- CLAUDE.md section 7: write down the command, reason, cost and rollback before any cloud change. Keep the live revision until the replacement passes the release gate.

## Decision

1. **Two-stage Dockerfile.** The first stage runs `npm ci` and `npm run build` in `web/`. The runtime stage copies `public/app` from it. Both stages use the same pinned `node:22-slim` digest. Add `**/node_modules` to `.dockerignore`. The Cloud Build smoke step also fetches `/app/` and one built asset.
2. **Service config in git.** `ops/deploy/momentum.env.yaml` holds non-secret values. Secrets are referenced by name with `--update-secrets`. `ops/deploy/momentum.flags` holds the rest: min and max instances, concurrency 20, session affinity, CPU boost, timeout 120 s, 1 vCPU, 1 GiB. The first version is generated from the live service and diffed, showing names only for secret-backed vars.
3. **`ops/deploy/deploy.sh <tag>`.** It refuses a dirty tree and builds with Cloud Build, tagging the image with the commit SHA in the existing Artifact Registry repository. It then runs `gcloud run deploy momentum --no-traffic --tag <tag>` with the checked-in config, runs the preflight on the tagged URL and writes the output to `docs/arc/delivery/changes/`. It stops there. It never moves traffic.
4. **Preflight additions.** `/app/` returns 200, idempotency scope is `shared-firestore`, the budget policy parses and `peek` works, the guard and flag state are printed, the optimizer byte setting is printed, the duplicate `job_id` check passes, and today's budget counters are shown.
5. **Traffic.** After the release gate, move traffic manually with `gcloud run services update-traffic momentum --to-revisions <new>=100`. The previous revision keeps a `prev-<date>` tag and is not deleted. Rollback: `update-traffic --to-revisions <previous>=100`.
6. **Demo scaling.** Now to 2 December: min 1, max 6. 3 and 4 December: min 2, max 6. From 5 December: min 0, max 4. Turn on startup CPU boost and set the service-level max to 6. Each change is one deploy through the script, with a change record.

## Consequences

- Any commit can be rebuilt into the same image, including `/app`. The live config is reviewable in git, and drift is visible.
- **Cost per day** (prices NOT VERIFIED: no pricing page or calculator was read; they must be checked in the Google Cloud pricing calculator before the release gate. ₹96.7 per USD from `src/fx-fallback.json`): an idle min instance costs about ₹42 a day, and two cost about ₹84. Active request time at demo load stays under about ₹10 a day. About ₹620 for 24 November to 4 December, before Gemini. Startup CPU boost adds CPU cost only during start-up.
- **Billing credits:** a founder must confirm in the console that credits cover Cloud Run and Vertex AI. The CLI cannot show credit scope.
- **Failure modes:** a failed build or preflight leaves the live revision untouched, because the new revision has no traffic. A bad config file is caught by the diff and the preflight. If Artifact Registry or Cloud Build is unavailable, nothing deploys and the live revision keeps serving.
- The deploy script needs the deployer's gcloud identity with run and build permissions. It prints no secrets, and the env file contains none.
- Cloud Build source archives (1,167,178,518 bytes, about 1.09 GiB, in `prepagent-hack_cloudbuild`, US; `gcloud storage du -s` on 2026-11-23) keep growing. A lifecycle rule is a separate change.
- **Rollback:** traffic back to the tagged previous revision, which takes seconds. Scaling reverts by deploying the earlier flags file.

## Alternatives rejected

1. **Keep deploying by hand.** Rejected. It cannot be reproduced or reviewed, and the `/app` bundle cannot be traced to a commit.
2. **Commit the built `public/app`.** Rejected. Build output in git drifts from the source and inflates reviews. A build in the image is the single source.
3. **Cloud Deploy pipeline.** Rejected for the finals. It adds a new service, delivery pipeline and IAM for one service and one environment. The script and Cloud Build cover the need. Revisit after December.
4. **Terraform for the service.** Rejected for now. It needs state storage and an import of the live service 11 days before the pitch. The checked-in flags file gives most of the reviewability.
5. **Min instances 0 on demo days.** Rejected. A cold start on stage risks the 20 November saturation pattern. About ₹84 a day is cheap insurance.
6. **Min instances 2 from today.** Rejected. It doubles idle cost on rehearsal days, when one warm instance is enough.
