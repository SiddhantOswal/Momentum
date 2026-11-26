# ARC-M6-22: open the app at `/` and remove hackathon wording

- Owner: backend and frontend engineers. Tier B (routing and copy), with a new guard test.
- Asked by: Om, 2026-11-26: "send / to the new app and update CLAUDE.md", then "this is now a real product and we should not mention hackathon project anywhere" (after seeing "The current lot could not be read. Start or renew the temporary hackathon session.").
- Depends on: ARC-M6-21.

## What changed
- `/` answers 302 to `/app/`. The old dashboard bookmarks (`/dashboard`, `/dasboard`) go to `/app/`, and `/impact` opens Insights (`/app/#/insights`).
- The previous interface moves to `/classic`, linked from nowhere, so its tests and the release smoke check (`/ui/*` assets) keep working until it is retired in its own ticket.
- Server messages: "Start or renew the temporary hackathon session." reads "Your session has expired. Reload the page to start a new one."; "Hackathon authorization ..." reads "Sign-in is not set up on this deployment."; the approval note returned by `/api/auth/config` reads "Approval is recorded against this session."
- The previous interface drops "Hackathon session" and the competition name from its footer.
- `CLAUDE.md` section 4: approval is recorded against the session until named sign-in exists, no screen names a supervisor who did not sign in, and user-facing text carries no demo, prototype, simulated-approval or hackathon wording. Data-source labels stay.
- New test `test/product-wording.test.js`: no string literal in `index.mjs`, `src`, `web/src`, `public/impact.html` or `prompts` names the hackathon or the competition. Identifiers (the `HACKATHON_DEMO` mode, module paths, element IDs) are allowed.

## Not changed
- The authorization mode value `HACKATHON_DEMO`, error codes such as `DEMO_SESSION_REQUIRED`, the cookie name and the module names are code, not text, and stay; renaming them touches stored records and the deployment flags.
- The previous interface at `/classic` still carries its own demo labels; it is unlinked and waits to be retired.

## Acceptance criteria
- `GET /` returns 302 with `Location: /app/`; `/classic` serves the previous interface.
- No user-facing string names the hackathon; the guard test fails when the old messages are put back.
- `npm test`, `eval:offline` and the browser suite pass.
