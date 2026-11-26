# Palette trials

Two trials for Home and Insights. Neither is wired into the app: `palettes.css` changes nothing unless `data-palette="mono"` or `data-accent="yellow"` is set on `<html>`.

- **Monochrome** (`data-palette="mono"`): page and ink at 95% black (`#0D0D0D`), cards at 92% (`#141414`), greys between, white text and accent. Light and dark. The kraft card becomes the one inverted card on a page. Cards get square corners and corner ticks, bars become dot-matrix segments, the logo and the line illustration go grey. Alerts keep their colour: green ok, red error and low confidence, amber warning.
- **Yellow** (`data-accent="yellow"`): the orange accent swapped for yellow, light and dark. In light mode accent-coloured text uses a darker amber, because yellow text on a light page fails contrast. The tan kraft card is replaced by a neutral one (near-black on a light page, light grey on a dark page) and the line illustration's boxes are muted, so yellow is the only warm colour besides status marks.
- **Logo** (either trial): `assets/logo-on-light.png` and `logo-on-dark.png` are the stencil letters only, cut from `web/src/assets/logo-momentum.jpg` into a transparent PNG. Adopting it means swapping the image in `Frame.tsx` per theme, or turning the letters into an SVG.

## Render the samples

Serve the app (`npm run preview:local`, any port), then:

```sh
node docs/arc/design/palette-trials/render.cjs http://127.0.0.1:4173 docs/arc/design/palette-trials/out
```

The data is fixture data. The model scores and the September month come from `docs/evidence/impact-v3.json` and `docs/arc/delivery/data/stale-claims.md`. The PKBX0041 job is the m2 re-run in `data/PKBX0041-m2-rerun.md`, which still awaits Om's sign-off. Box style, flute and the two scrap-cost bars are placeholders. These images are design samples, not evidence.

## What adopting either palette would take

The tokens in `web/public/arc-tokens.css` carry most of the change. Some colours are hard-coded and need the token instead:

- Button and launcher label colour: `m.css` lines 71, 137 and 203 (`#18110E`, `#1B0F0B`).
- The Arc mark glyph: `components/m/icons.tsx` lines 45 to 47.
- Orange tints as `rgba(232,102,79,…)`: `m.css` lines 85, 131, 132, 138; `home.css` lines 47, 48, 56, 88, 93, 99; `explorer.css` line 18; `planning.css` line 90.
- `#E8664F` in `PrepFlow.tsx` line 106 and in the machine and conveyor illustrations.
- `.hm-open` (the job-card button) is a fixed dark brown.
