# Momentum web app

React 19, Vite 8 and Tailwind 4. `npm run build` type-checks and writes the app to `../public/app`, which the backend serves at `/app/`. `npm run dev` serves it on port 5173 and proxies API calls to the backend on 127.0.0.1:4173 (or `MOMENTUM_BACKEND`).

The screens follow the approved designs in `docs/arc/design/`. `src/m.css` ports the design CSS, with the same class names, so a page can be checked against its HTML source.

## Layout

- `src/App.tsx` maps each hash route to a page. Routes are listed in `src/lib/routes.ts`.
- `src/pages/<Name>.tsx` holds one page each, so page groups can work in parallel without touching shared files.
- `src/components/Frame.tsx` is the sidebar, top bar and Arc workspace around every page except `#/operator`.
- `src/components/arc/` is the Arc panel. `AnswerView.tsx` has one renderer per answer block kind; replace an entry in `BLOCK_RENDERERS` to give a block its designed card.
- `src/lib/arc.ts` is the client for `/api/arc/*`, with types that mirror `src/arc/routes.js`, and the plain words for each error code.

## Shared components

Import from `src/components/m`.

- `Card`: the design's card, with a title on the left and meta (a note or a chip) on the right. `kraft` is the one emphasis surface per page.
- `PageHeader`: the page title and its one-line description.
- `Button` and `ButtonLink`: primary (accent fill) or secondary (outline), optionally small or with the trailing arrow.
- `Chip`: a chip with the design's mark (solid, ring, dashed, dim or accent).
- `ProvenanceChip`: a fixed provenance label by kind, with the text from the designs or the product spec section 5.
- `LabelChip`: a chip for a label string sent by the server.
- `Stat`: label, large tabular value, unit and sub-line. A null value reads "Not recorded", never 0.
- `NotConnected`: the designed state for an element with no backend yet; it says what is missing and shows no figure.
- `Stepper`: the four New Lot steps with the current one marked.
- `Table`: the design's ruled grid table with an uppercase header row.
- `Banner`: a full-width alert card with a status line, one sentence and actions.
- `Icon`, `IdleMark`, `ArcMark`: icons drawn from the design's SVG paths.

Every figure on a page comes from an API response. If the route does not exist yet, use `NotConnected` instead of a number from a design.
