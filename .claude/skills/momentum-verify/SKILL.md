---
name: momentum-verify
description: Check one built UI unit against its approved design, both themes, viewports and tests, and record the evidence.
argument-hint: <UnitId, for example U04>
allowed-tools: Read Grep Glob Bash(node tools/*) Bash(npm *) Bash(npx *) Bash(git status*) Bash(git diff*) Edit
---
Verify unit `$ARGUMENTS` without changing application code. Only `docs/migration/progress.json` may be edited.

1. `node tools/migration/cli.mjs context $ARGUMENTS` for the screens and tests.
2. For every screen: `node tools/visual/capture.mjs --ref <ScreenId> --route <route> --viewports 1440x900,1280x800,1024x768`. Open the dark and light screenshots next to the reference and list each visible difference (layout, copy, spacing, colour, icon, state). If the viewport of the owner's MacBook is not recorded, say the result is provisional.
3. Confirm navigation: one sidebar entry, correct label, correct breadcrumb, legacy address redirects.
4. Run the unit's browser specs, `npx tsc -b`, and `npm test` in `web/`.
5. Check every control: wired to a real route, or showing the designed not-connected state. Do not count fixture-backed behaviour as verified backend behaviour.
6. Record in the ledger: `visual.dark`, `visual.light`, `visual.viewports`, `functional` (PASSED, FAILED, BLOCKED, NOT_EXECUTED) and the evidence. Use NOT_EXECUTED for anything you did not run.

Report differences as a short list. Do not describe a match you did not look at.
