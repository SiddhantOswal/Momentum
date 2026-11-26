---
name: momentum-context
description: Build the smallest sufficient context package for one UI migration unit. Read-only.
argument-hint: <UnitId, for example U04>
allowed-tools: Bash(node tools/migration/cli.mjs *) Bash(node tools/design/extract.mjs *) Read Grep Glob
---
For unit `$ARGUMENTS`:

1. Run `node tools/migration/cli.mjs context $ARGUMENTS`.
2. For each design screen it lists, pull only that screen with `node tools/design/extract.mjs <ScreenId> --theme dark` (and `--theme light` when the markup differs). Light and dark text is identical, so one markup read is normally enough; the CSS values for the other theme are the `.m.lt` rules.
3. Read the PNG for the state you are about to build, one at a time.
4. Read only the interfaces of the shared components named in the package (`web/src/ui/components.tsx`, `web/src/routes.ts`), not the whole folder.

Report file paths and symbols rather than pasting files. Do not edit anything.
