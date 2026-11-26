---
name: momentum-page
description: Implement one UI migration unit from its contract, verify both themes, update the ledger, then stop.
argument-hint: <UnitId, for example U04>
disable-model-invocation: true
allowed-tools: Read Grep Glob Edit Write Bash(node tools/*) Bash(npm *) Bash(npx *) Bash(git status*) Bash(git diff*) Bash(git log*) Bash(git branch*)
---
Implement unit `$ARGUMENTS`. Follow `CLAUDE.md` and `docs/migration/00-execution-contract.md`.

1. **Validate.** `node tools/migration/cli.mjs validate`, then `node tools/migration/cli.mjs context $ARGUMENTS`. Stop if the unit is unknown, a dependency is not at UI_VERIFIED or later, or it has a hard blocker.
2. **Workspace.** `git branch --show-current` must be the migration branch recorded in `docs/migration/progress.json`. `git status --short` must show nothing you did not make. Stop otherwise.
3. **Context.** Read the unit contract. Retrieve each screen with `node tools/design/extract.mjs`. Read the matching PNG. Read the interfaces in `web/src/ui/components.tsx` and the existing code the contract lists. Do not read the full audit.
4. **Build.** Put the page in `web/src/pages/`, register it in `web/src/App.tsx`, and use the shared components and the tokens in `web/public/arc-tokens.css`. Add a shared component only when two screens need it. Take every label, number and chip from the design; never invent copy.
5. **Data.** Call the real routes through `web/src/lib/api.ts`. Where a route does not exist, show the designed not-connected state. Keep fixtures in test files only. A failed request shows an error, never fixture data.
6. **Verify.** Run `node tools/visual/capture.mjs --ref <ScreenId> --route <route>` for each screen (needs the Vite dev server; see its header). Look at the screenshots against the reference in both themes at 1440x900 and 1280x800. Run the structural checks, `npx tsc -b` and `npm test` in `web/`, and the browser specs for this unit.
7. **Record.** Update this unit in `docs/migration/progress.json`: state (UI_IMPLEMENTED until both themes are checked, then UI_VERIFIED), `visual`, `evidence` with the commands you ran and what they printed, and `notes` for any difference from the design. Then `node tools/migration/cli.mjs validate`.
8. **Report** in a few lines: what was built, what was verified and how, what differs from the design, what is not connected. Then stop. Do not start another unit.

Never commit or push. Fixture-backed behaviour is not functional verification.
