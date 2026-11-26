# Master prompt sections against what is on disk

Status words: DONE (built and checked), PARTIAL (built, a part not checked), OPEN (not done). Evidence ids are in `docs/migration/progress.json`.

| Prompt section | Status | Where / evidence | Remaining |
|---|---|---|---|
| 3 Consume preparation handoff | DONE | No manifest existed from a prior session. Facts rediscovered once and stored in `MANIFEST.json` | none |
| 4 Migration workspace | PARTIAL | Branch `arc/ui-vnext` from `arc/main` `cb1338f` in the main checkout (no separate worktree). Baseline `npm test` 1107/1108 (CHK-BASE-ROOT). Delta check: `revalidate.sh` NO DRIFT | Re-run revalidate at session start. Branch has no commits |
| 5 Source-of-truth hierarchy | DONE | `00-execution-contract.md`, `CLAUDE.md` section 9 | none |
| 6 Design index | DONE | `03-design-inventory.json` (30 screens, 14 units), `tools/design/extract.mjs`, byte-identical check CHK-EXTRACT | Per-screen interaction states beyond frozen HTML (zip scripts: theme, alert dismiss, Planning pick) not itemised |
| 7 CLAUDE.md and rules | DONE | `CLAUDE.md` (101 lines), `.claude/rules/web-ui.md` | none |
| 8 Skills | PARTIAL | `.claude/skills/momentum-{status,next,page,verify,checkpoint,sync,context}`; frontmatter parsed | A fresh session must confirm `/momentum-*` are listed. `momentum-page` and `momentum-checkpoint` are manual-only by design |
| 9 Queue and ledger | DONE | `queue.json`, `progress.json`, `cli.mjs validate` | States change as units are built |
| 10 Design system extraction | PARTIAL | `12-design-system-spec.md`, `web/public/arc-tokens.css`, `web/src/design/foundation.css` | Hover, disabled, loading and chart palettes are not specified by the design; PD-04. Inter Tight vs Inter: PD-14 |
| 11 Light and dark | DONE | Tokens by `data-theme`; theme-switch spec; viewed dark and light | none |
| 12 Shell and navigation | DONE | `web/src/routes.ts`, `web/src/ui/Shell.tsx`; `shell-navigation.spec.js` | Mobile layout is an adaptation (PD-16) |
| 13 Primary MacBook fidelity | PARTIAL | Matrix 1440x900, 1280x800, 1024x768, 768x1024, 390x844: 70 runs, 0 structural failures | Owner viewport unknown; results provisional |
| 14 Component library | DONE for the foundation set | `web/src/ui/components.tsx` (PageHeader, Card, Button, Chip, Status, KeyValue, CheckRow, Stepper, Alert, NotConnected, TableRow) | Inputs, selects, tabs, dialogs, drawers, tooltips, skeletons, chart containers are added by the first unit that needs them |
| 15 Assets | PARTIAL | Logo copied to `web/public/brand/` | `home-machine.jpg`, `plant-machine.jpg`, `specimen.jpg` are used only by later units and are not yet in `web/public`; no font file for Inter Tight |
| 16 Preserve functionality | DONE | Backend untouched; `lib/api.ts`, `lib/session.ts`, `lib/live.ts` kept | Old screens only in `arc/main` history |
| 17 Integration boundaries | DONE (documentation) | `pages/*.md`, `04-capability-matrix.csv`, `07-backend-contracts.md` | Typed data interfaces are written by each unit |
| 18 Visual regression | DONE | `tools/visual/capture.mjs`, structural checks | No automated pixel diff by design; accessibility scan NOT EXECUTED (CHK-A11Y) |
| 19 Foundation preview | DONE | `web/src/preview/Foundation.tsx` at `#/_foundation`, development only | none |
| 20 Unit contracts and pilots | DONE | `pages/U01..U14.md`; pilots U04, U03, U10 | Pages are generated skeletons; refine at first use |
| 21 Token efficiency | PARTIAL | cli `context`, extractor (7 to 25% smaller), short contracts | Actual token use not measured |
| 22 to 23 Quality, AI and cloud boundaries | DONE | `00-execution-contract.md`, `.claude/rules/web-ui.md`; no cloud or backend change made | none |
| 24 Verification | PARTIAL | 60/60 browser, web 7/7, tsc, build, quality check, ledger validate | `npm test` has 1 new failure (CHK-ROOT-TEST); a11y and live-backend checks NOT EXECUTED |
| 26 Definition of done | NOT MET | | Commit the work with the owner's identity; resolve PD-14 to PD-16; fix or hand off CHK-ROOT-TEST; confirm skills load in a fresh session |
