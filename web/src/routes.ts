// The only definition of the sidebar, breadcrumbs and route aliases. Labels and order come from the
// approved design (docs/arc/design/source/html/*/Main.html, the <aside class="side"> block).

export type RouteKey =
  | "home"
  | "new-lot"
  | "plant-explorer"
  | "preparation-flow"
  | "insights"
  | "photo-diagnosis"
  | "planning";

export type RouteDef = {
  key: RouteKey;
  label: string;
  path: string;
  title: string;
  subtitle: string | null;
  group: "main" | "future";
  icon: string;
  unit: string;
};

export const ROUTES: readonly RouteDef[] = [
  { key: "home", label: "Home", path: "/home", group: "main", unit: "U02",
    title: "Home", subtitle: null,
    icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { key: "new-lot", label: "New Lot", path: "/new-lot", group: "main", unit: "U03",
    title: "New lot", subtitle: "Check each value against the order before you confirm.",
    icon: "M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6" },
  { key: "plant-explorer", label: "Plant Explorer", path: "/plant-explorer", group: "main", unit: "U04",
    title: "Plant Explorer", subtitle: "Stage by stage. Illustrative, no live readings.",
    icon: "M3 21V10l6 3V10l6 3V6h3v15z" },
  { key: "preparation-flow", label: "Preparation Flow", path: "/preparation-flow", group: "main", unit: "U05",
    title: "Preparation flow", subtitle: "Purchase order to approved job card, step by step.",
    icon: "M4 5h5v5H4zM15 14h5v5h-5zM9 8h3a3 3 0 0 1 3 3v3" },
  { key: "insights", label: "Insights", path: "/insights", group: "main", unit: "U06",
    title: "Insights", subtitle: "Quality, impact and next steps. Every view is labelled.",
    icon: "M5 20V11M12 20V5M19 20v-7" },
  { key: "photo-diagnosis", label: "Photo Diagnosis", path: "/photo-diagnosis", group: "main", unit: "U07",
    title: "Photo diagnosis", subtitle: "Ten approved photos only.",
    icon: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4" },
  { key: "planning", label: "Planning", path: "/planning", group: "future", unit: "U08",
    title: "Planning", subtitle: "The next phase of Momentum. A roadmap, not live features.",
    icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
];

// Names and addresses from the earlier legacy page and the first React app. They resolve to the
// new routes but never appear in the sidebar.
const ALIASES: Readonly<Record<string, RouteKey>> = {
  floor: "home",
  lots: "new-lot",
  impact: "insights",
  models: "insights",
  defects: "photo-diagnosis",
  "defect-check": "photo-diagnosis",
  "screen-impact": "insights",
  "screen-order-input": "new-lot",
  "screen-defect-check": "photo-diagnosis",
};

export const DEFAULT_ROUTE: RouteKey = "home";

export function resolveRoute(hash: string): { route: RouteDef; canonical: boolean } {
  const segment = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  const direct = ROUTES.find((route) => route.key === segment);
  if (direct) return { route: direct, canonical: true };
  const aliased = ROUTES.find((route) => route.key === ALIASES[segment]);
  if (aliased) return { route: aliased, canonical: false };
  return { route: ROUTES.find((route) => route.key === DEFAULT_ROUTE)!, canonical: false };
}
