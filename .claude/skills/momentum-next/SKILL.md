---
name: momentum-next
description: Pick the next eligible UI migration unit and print the command that starts it. Read-only.
allowed-tools: Bash(node tools/migration/cli.mjs *) Read
---
1. Run `node tools/migration/cli.mjs next`.
2. If a unit is returned, read its contract in `docs/migration/pages/` and list any open decision from `docs/migration/11-product-decisions.md` that touches it.
3. Return the unit, its design screens, its backend contracts, and the exact start command from the CLI.

If nothing is eligible, run `node tools/migration/cli.mjs status` and say which dependency each unit waits for.

Do not implement the unit.
