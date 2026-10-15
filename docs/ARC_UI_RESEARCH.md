# Arc UI component research and adoption

Reviewed 15 October 2026 using official sources:

- [Component catalog](https://uiarc.dev/components/button) and [assistant index](https://uiarc.dev/llms.txt)
- [Installation / framework requirements](https://uiarc.dev/docs/installation)
- [Licence](https://uiarc.dev/license)
- [Button source registry](https://uiarc.dev/r/button.json)
- [Dialog](https://uiarc.dev/components/dialog), [dropzone](https://uiarc.dev/components/file-dropzone), [stepper](https://uiarc.dev/components/stepper)

The official installation guide requires React 19, TypeScript and a path alias. Components use CSS modules and semantic CSS variables; Tailwind is not required. The retrieved button source imports React hooks, `motion/react`, shared motion tokens and a CSS module; its registry declares `motion`. It cannot be pasted into this ES-module frontend. No Arc packages, source files or Pro assets were copied into Ustaad. No framework/build system was introduced.

Free components are MIT-licensed according to the official licence page; Pro components use a separate paid licence with seat and redistribution restrictions. This task has no Pro licence, and no Pro source was accessed. All native equivalents are original application code using ordinary browser interaction patterns.

| Candidate | Official catalog finding | Licence/framework | Use and adaptation decision |
|---|---|---|---|
| Sidebar / collapsible navigation | No separately named free sidebar in inspected component list | Not assumed available | Four destinations fit horizontal native navigation; no sidebar needed |
| Navigation menu | Mega menu morph listed as Pro | Paid; React | Not used; app needs ordinary links |
| Tabs / breadcrumb | Both listed free | MIT; React/CSS modules | Hash links and `aria-current` for distinct app destinations; avoid using tab roles for routed screens. No unnecessary breadcrumb |
| Stepper | Listed free; dedicated docs inspected | MIT; React/motion | Native ordered workflow strip and persisted lifecycle; completion comes only from returned state |
| Dropdown / context menu | Both listed free | MIT; React | Use native selects; no hidden secondary production actions |
| Button / icon button | Button free; documented size, busy and native semantics; source inspected | MIT; React + Motion | Native button, 44px primary target, disabled/busy feedback, focus, pressed state. Original CSS |
| Split button / confirmation | Split button and confirm morph listed free | MIT; React | Split actions unnecessary; native dialog for concrete supervisor approval |
| Input / number field / textarea | All listed free | MIT; React | Native labelled controls with schema bounds, finite values, no production defaults |
| Select / date picker | Both listed free | MIT; React | Native select/date for keyboard and tablet familiarity |
| Slider | Listed free | MIT; React | Native range + output, actual lever bounds, score on release, stale request guard |
| File dropzone | Listed free; dedicated docs inspected | MIT; React | Native file input over generous drop target; keyboard browse, MIME/size errors, drag feedback, selected filename |
| Checkbox / radio | Checkbox, radio group/cards listed free | MIT; React | Native explicit confirmations and exact source-line selection |
| Metric card / badge | Both listed free | MIT; React | Returned Impact values and textual state only; no invented summary statistics |
| Table / sortable table | Sortable data table listed free | MIT; React | Semantic comparison/history tables, captions and scroll regions. Sorting not needed for fixed lever order |
| Charts | Line/bar and other chart patterns listed free | MIT; React | Pinned local Chart.js 4.4.8, required units, zero-origin axes, factual returned data, data tables, reduced motion and chart cleanup |
| Tooltip / expandable panels | Tooltip, accordion, expandable card listed free | MIT; React | Native details/summary; units and critical provenance visible without hovering |
| Alert / toast | Both listed free | MIT; React | Persistent inline errors + polite live regions; transient confirmed-action toast. No success animation before response |
| Dialog / bottom sheet | Both listed free; dialog docs inspected | MIT; React | Native modal dialog handles focus containment and Escape; responsive bounded surface rather than extra sheet abstraction |
| Skeleton / loading / empty state | Skeleton, progress, empty state listed free | MIT; React | Truthful indeterminate busy states and actionable empty/unavailable messages. No fabricated percentages or stages |
| Timeline / progress tracker | Timeline, stepper, progress listed free | MIT; React | Ordered actual SSE events with readable labels and exact identifiers in details. No simulated tool completion |

Accessibility is implemented using native semantics, associated labels, visible focus, Escape/focus return, live status, reduced motion, sufficient text and control contrast, and chart data alternatives. Component-specific accessibility is verified in the browser suite instead of assuming a library label establishes compliance.

The design uses 4/8/12/16/24/32/48/64 spacing, 5–12px control/surface radii, IBM Plex Sans (self-hosted, OFL), graphite surfaces, monsoon blue `#86bdd4`, kraft `#c8a57c`, and 180ms interaction transitions. Chart.js and Plex licence notices ship with their assets.
