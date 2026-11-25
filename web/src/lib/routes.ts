import { useEffect, useState } from "react";

export type NavKey = "home" | "new-lot" | "explorer" | "prep-flow" | "insights" | "photo" | "planning";

export type RouteId =
  | "home" | "new-lot/order" | "new-lot/conditions" | "new-lot/settings" | "new-lot/approve"
  | "explorer" | "prep-flow" | "insights" | "photo" | "planning" | "operator";

/** `crumb` is the page name in the breadcrumb and on the Arc host chip, as each design writes it. */
export type Route = { id: RouteId; nav: NavKey | null; crumb: string };

export const ROUTES: Record<RouteId, Route> = {
  "home": { id: "home", nav: "home", crumb: "Home" },
  "new-lot/order": { id: "new-lot/order", nav: "new-lot", crumb: "New lot" },
  "new-lot/conditions": { id: "new-lot/conditions", nav: "new-lot", crumb: "New lot" },
  "new-lot/settings": { id: "new-lot/settings", nav: "new-lot", crumb: "New lot" },
  "new-lot/approve": { id: "new-lot/approve", nav: "new-lot", crumb: "New lot" },
  "explorer": { id: "explorer", nav: "explorer", crumb: "Plant Explorer" },
  "prep-flow": { id: "prep-flow", nav: "prep-flow", crumb: "Preparation flow" },
  "insights": { id: "insights", nav: "insights", crumb: "Insights" },
  "photo": { id: "photo", nav: "photo", crumb: "Photo diagnosis" },
  "planning": { id: "planning", nav: "planning", crumb: "Planning" },
  "operator": { id: "operator", nav: null, crumb: "Operator" },
};

export const href = (id: RouteId) => `#/${id}`;

// "#/new-lot" alone opens the first step; anything unknown falls back to Home. A query after the
// path ("#/operator?job=X") belongs to the page, so it is not part of the route.
function routeFromHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "").split("?")[0].replace(/\/+$/, "");
  if (path === "new-lot") return ROUTES["new-lot/order"];
  return Object.hasOwn(ROUTES, path) ? ROUTES[path as RouteId] : ROUTES.home;
}

// Hash routing keeps one HTML entry point under /app/ and works behind any static host.
export function useRoute(): Route {
  const [route, setRoute] = useState(() => routeFromHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(routeFromHash(location.hash));
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
