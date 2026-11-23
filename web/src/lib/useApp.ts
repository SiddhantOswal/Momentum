import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
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

const themeKey = "momentum-theme";
const systemPreference = matchMedia("(prefers-color-scheme: light)");

function readThemeChoice(): Theme | null {
  try {
    const saved = localStorage.getItem(themeKey);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

function subscribeToSystemTheme(onChange: () => void) {
  systemPreference.addEventListener("change", onChange);
  return () => systemPreference.removeEventListener("change", onChange);
}

const readSystemTheme = (): Theme => systemPreference.matches ? "light" : "dark";

export function useTheme() {
  const [choice, setChoice] = useState(readThemeChoice);
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, readSystemTheme);
  const theme = choice ?? systemTheme;
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    const background = getComputedStyle(root).getPropertyValue("--bg").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background);
  }, [theme]);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setChoice(next);
    try { localStorage.setItem(themeKey, next); } catch { /* Keep the choice for this page. */ }
  }

  return { theme, toggle };
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
