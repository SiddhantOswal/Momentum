import { useCallback, useEffect, useState } from "react";
import { getJson, type Result } from "./api";

export type Screen = "floor" | "lots" | "defects" | "impact" | "models";
export const SCREENS: Screen[] = ["floor", "lots", "defects", "impact", "models"];

const screenFromHash = (): Screen => {
  const name = location.hash.replace(/^#\/?/, "").split("/")[0];
  return (SCREENS as string[]).includes(name) ? (name as Screen) : "floor";
};

// Hash routing keeps one HTML entry point and works behind any static host.
export function useScreen() {
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  useEffect(() => {
    const onChange = () => setScreen(screenFromHash());
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  const go = useCallback((next: Screen) => { location.hash = "/" + next; }, []);
  return { screen, go };
}

export type Theme = "dark" | "light";
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === "light" ? "light" : "dark"));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f2f0eb" : "#0b0d0f");
    try { localStorage.setItem("momentum-theme", theme); } catch { /* the choice lasts for this page only */ }
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

// Loads a GET endpoint once (and on demand), keeping the last good data while refreshing.
export function useResource<T>(path: string | null) {
  const [state, setState] = useState<{ loading: boolean; result?: Result<T> }>({ loading: !!path });
  const load = useCallback(() => {
    if (!path) return () => {};
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    getJson<T>(path, controller.signal).then((result) => {
      if (!controller.signal.aborted) setState({ loading: false, result });
    });
    return () => controller.abort();
  }, [path]);
  useEffect(() => load(), [load]);
  return { ...state, reload: load };
}
