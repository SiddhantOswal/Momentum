# Change: deploy `v3` with ARC-M6-23 (no UI tags) to production

- Date: 2026-11-27
- Approved by: Om, in the session ("Deploy it").
- Service: Cloud Run `momentum`, `asia-south1`, project `prepagent-hack`.
- Before: `momentum-v3-prod1` serves 100% (`changes/2026-11-26-v3-production-deploy.md`).

## What changes
Only the image: `v3` at `0bbd7a4` (ARC-M6-23 removes every tag and caption badge from `/app` and Arc). Settings, secrets, limits and origins are the same env files as the 26 Nov record; the Gemini limits are unchanged, as Om has not chosen between a day limit of 250 and a ₹800 cap.

## Commands
1. `npm --prefix web run build`; `tools/prepare-release-snapshot.py`; one `gcloud builds submit` with `cloudbuild.yaml`.
2. Test revision `momentum-v3-rc2`, tag `v3rc`, no traffic, origin the tag URL: `tools/release-preflight.mjs` and a text scan of every `/app` route.
3. Production revision `momentum-v3-prod2`, no traffic, origin `https://momentum-ai.cloud.run`; read back; `gcloud run services update-traffic momentum --to-revisions=momentum-v3-prod2=100`.
4. On the live site: `/` to `/app/`, `/api/status` public view, one PO1 run through Arc to the Approve card (not approved), route text scan. Remove the `v3rc` tag.

## Cost
One Cloud Build; about four Gemini calls (two PO1 runs at about ₹2.29 each, if both are run); revisions at min instances 0.

## Rollback
`gcloud run services update-traffic momentum --to-revisions=momentum-v3-prod1=100` (the previous v3 build), or `momentum-00023-yaz=100` for the build before v3.

## Result
Run 2026-11-27.
- Build: `v3` at `215e411`, manifest `f3fe4774…`, Cloud Build `8171c8c2` SUCCESS, image `prepagent@sha256:a170d375…`.
- Test revision `momentum-v3-rc2` (tag `v3rc`): preflight passed (model versions verified, budget-v2 enforced, 40 calls for a session, counter 0). Route text scan of all 11 `/app` routes: no removed tag text; the only matches were the "Use weather record" button and the "From order to approved card" title. PO1 was not run on the test revision, to save Gemini calls.
- Production revision `momentum-v3-prod2`: origin `https://momentum-ai.cloud.run`, limits unchanged, pitch secret set, 42 settings, Ready. Traffic moved: `momentum-v3-prod2` 100%.
- Live checks: `/` 302 to `/app/`, `/health` 200, public `/api/status` with the 8 fields only, the route text scan clean as on the test revision, and PO1 through Arc to the Approve card (56.4 to 49.2 kg, ₹384 lower; not approved). The panel updated without a reload this time.
- `v3rc` tag removed (404). `momentum-v3-prod1` and `momentum-00023-yaz` kept for rollback.
- Gemini today: 6 attempts, ₹13.71 (₹2.29 an attempt).
