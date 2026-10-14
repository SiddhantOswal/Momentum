# Release provenance

## Current source

No clean, commit-pinned release has been produced for the current source tree.
The repository was already dirty before this work. Preserve all pre-existing
modifications; this task did not stage or commit them. The current source
changes have no verified Cloud Build archive, image digest, Cloud Run revision,
or traffic assignment.

## Historical deployment record (not freshly verified)

`config/gcp-cloud-run.json` records:

- Project `prepagent-hack`, region `asia-south1`, service `prepagent`.
- Runtime service account
  `prepagent-run@prepagent-hack.iam.gserviceaccount.com`.
- Startup `npm start`, container port 8080, health `/health`.
- Private invocation (`allowUnauthenticated: false`) and service maximum two
  instances.
- Historical production revision `prepagent-00005-s5x` and historical
  zero-traffic candidates, including `prepagent-00011-yew`.
- Historical candidate digest
  `sha256:7d75f6ea42f67832d0cfb2240592be4b966a68fd68e8cf98038b131cc2117e75`
  and build ID `e01b285a-d6d2-4729-a6e4-31dd150b3786`.

The records describe older artifacts built from a dirty worktree and do not
prove the current source is deployed. They must not be used to claim that the
latest endpoint behavior is live.

## Release gate

Before deployment, obtain required external contracts, finish scoped
acceptance, identify the exact source commit and clean build context, verify
the existing registry/build/runtime configuration and service-account
permissions read-only, and obtain explicit deployment authorization. Keep
secrets out of source control and Cloud Run private. Do not create resources,
enable APIs, change IAM/billing/traffic, or increase the instance cap. Capture
actual build, digest, revision, URL, version and health evidence only after an
authorized deployment.
