# Momentum UI source (approved designs)

These files are the source of truth for the Momentum dashboard and Arc UI. They show layout, copy, states, labels and tokens for every screen.

- `html/dark/` and `html/light/`: one static HTML file per screen, with the exact CSS. Open any file in a browser; it needs the `assets/` folder beside it. Interactive states (alerts, checkboxes, the Planning explorer) are frozen in their default state.
- `png/dark/` and `png/light/`: full-page renders of the same screens.
- `assets/`: the logo plate, tagline, machine images and the approved specimen photo.

The HTML is a design reference, not production code. Rebuild the screens in the app's own frontend stack, reusing these tokens and measurements.

## Screens

- **Momentum:** Home (`Main`), New Lot (Order, Conditions, Settings, Approve, Recovery, Stale), Operator phone, Plant Explorer, Preparation Flow (normal, held, partial), Insights, Photo Diagnosis, Planning (future roadmap).
- **Arc by Momentum:** Start, Answer value, Answer chart, Out of scope, No data, Defect photo, Defect history, New lot (Source, Review, Conditions, Compare, Approve, Receipt, Replaced), Phone.

## Layout

- Design width is 1440 px. Sidebar 232 px; top bar 56 px; content padding 24 px.
- Content grid: 12 columns of 82 px with 16 px gaps (1160 px).
- Card radius 12 px; buttons and inputs 10 px; chips 6 px.
- Type: Inter for text, Inter Tight for headings and numbers (tabular figures). Key values and primary actions are at least 24 px and 16 px respectively.
- The Arc launcher sits in the top bar on every screen. Arc opens as a right-hand workspace over the dimmed page, or as a full-width sheet on phones.

## Colour tokens

Dark (default):

| Token | Value |
| --- | --- |
| `--bg` | `#121519` |
| `--sb` | `#0B0D10` |
| `--cd` | `#1A1E23` |
| `--rz` | `#21262C` |
| `--ln` | `#2A3038` |
| `--ln2` | `#3A434D` |
| `--tx` | `#EAEDF0` |
| `--mu` | `#A3ACB6` |
| `--dim` | `#7B8590` |
| `--ac` | `#E8664F` |
| `--ok` | `#5FBF98` |
| `--wn` | `#E3A340` |
| `--bd` | `#F0707A` |
| `--inv` | `#111` |
| `--ct` | `#F3A394` |
| `--g1` | `#4E9E7F` |
| `--g2` | `#6A7683` |
| `--pap` | `#D8C6A3` |
| `--bar0` | `#4A5460` |
| `--stg` | `#0E1013` |

Light (`.m.lt`):

| Token | Value |
| --- | --- |
| `--bg` | `#EEF0F2` |
| `--sb` | `#E3E6E9` |
| `--cd` | `#FFFFFF` |
| `--rz` | `#E5E8EB` |
| `--ln` | `#D5DADF` |
| `--ln2` | `#B3BCC5` |
| `--tx` | `#14181C` |
| `--mu` | `#46515C` |
| `--dim` | `#66717C` |
| `--ac` | `#E8664F` |
| `--ok` | `#1F7A58` |
| `--wn` | `#8F5A00` |
| `--bd` | `#B8333F` |
| `--inv` | `#FFFFFF` |
| `--ct` | `#B23F2A` |
| `--g1` | `#1F7A58` |
| `--g2` | `#7E8995` |
| `--pap` | `#B38D52` |
| `--bar0` | `#8F99A4` |
| `--stg` | `#F6F4EE` |

Kraft emphasis surface (one per page, for the most important card):

```css
.m .kr,.m.lt .kr{--cd:#D7C39A;--rz:rgba(255,255,255,.38);--bg:rgba(255,255,255,.42);--ln:rgba(31,24,16,.22);--ln2:rgba(31,24,16,.4);--tx:#1F1810;--mu:rgba(31,24,16,.76);--dim:rgba(31,24,16,.68);--ok:#14573C;--wn:#6E4200;--bd:#9C2430;--ct:#9E3320;--bar0:rgba(31,24,16,.3);--g1:#14573C;--g2:rgba(31,24,16,.4);--inv:#D7C39A;
 background:linear-gradient(160deg,rgba(255,255,255,.16),transparent 50%),#D7C39A;border-color:rgba(31,24,16,.28);color:#1F1810;box-shadow:0 14px 28px -18px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,255,255,.12)}
```

## Provenance labels

Every value that is not measured carries a chip: Example, Sample, Synthetic demonstration, Model estimate, Modeled, Confirmed by operator, Missing, Demo session (simulated approval). Dashed outline means example or concept, ring means modeled, solid dot means confirmed or real.
