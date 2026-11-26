import { useCallback, useEffect, useState } from "react";
import { resolveRoute, type RouteDef } from "../routes";

export function useRoute() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  const { route, canonical } = resolveRoute(hash);

  // Old names and the empty hash settle on the canonical address without adding a history entry.
  useEffect(() => {
    if (!canonical && !hash.startsWith("#/_")) location.replace("#" + route.path);
  }, [canonical, hash, route.path]);

  const go = useCallback((target: RouteDef) => { location.hash = target.path; }, []);
  return { route, hash, go };
}
