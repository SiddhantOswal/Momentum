# Next steps (in order)

U04 Plant Explorer is built (INTEGRATION_PENDING). No other unit has been started. Foundation and U04 are still uncommitted until step 1 is done.

1. **Protect the work.** `git status --short`. Ask the owner for a git name and email, set them locally (`git config user.name`, `git config user.email` in this repo only), and make plain commits with no trailers, in logical groups: `web/` shell and routes; `test/browser/` updates; `tools/`; `.claude/` and `CLAUDE.md`; `docs/migration/`. Do not push. If the owner does not answer, copy the changed paths out of the container.
2. **Confirm the toolchain in a fresh session.** Run `bash docs/migration/handoff/setup.sh`, `node tools/migration/cli.mjs handoff`, and confirm `/momentum-status` and `/momentum-next` are listed. `momentum-page` and `momentum-checkpoint` are manual-only.
3. **Resolve open decisions that touch the foundation:** PD-14 (Inter or Inter Tight), PD-15 (live status in the top bar), PD-16 (below 900px). Record answers in `decisions.json` and `11-product-decisions.md`.
4. **Close the known failure.** `test/approve-client-body.test.js` asserts the removed `web/src/screens/Lots.tsx`. It is U03's acceptance item; until then the root suite shows 1 failure and the weather-timeout cancellation that also exists on `arc/main`.
5. **Optional foundation gaps:** accessibility scan (CHK-A11Y), shell against a running backend (CHK-LIVE), copy the machine photos into `web/public` when the first unit needs them.
6. **Pilots, only on the owner's go:** U04 Plant Explorer is done. Next U03 New Lot, then U10 Arc start. Copy `plant-machine.jpg` and `specimen.jpg` into `web/public/brand/` when a unit needs them. Pattern for a new page: `web/src/pages/<Name>.tsx` plus `<name>.css`, one case in `App.tsx`, one `test/browser/<name>.spec.js`. Start with `claude --model sonnet` and `/momentum-page U04`. Verify with `/momentum-verify U04`.
7. **Keep in sync** with `arc/main` through `/momentum-sync` at unit boundaries. Do not merge automatically.
8. **Later, outside this migration:** the Dockerfile still does not build `web/` (DR-018, ticket ARC-M6-08); Arc typed answers (M2-05, M2-06, M3-01); live Firestore, Vertex and BigQuery checks; Om's sign-off on figures (DR-019).
