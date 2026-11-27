import { useEffect, useState } from "react";

export type BackendState = "checking" | "connected" | "unreachable";

const CHECK_EVERY_MS = 30_000;

async function checkHealth(signal: AbortSignal): Promise<BackendState> {
  try {
    const response = await fetch("/health", { cache: "no-store", signal, headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => undefined);
    return response.ok && body?.ok === true ? "connected" : "unreachable";
  } catch {
    return "unreachable";
  }
}

/** The top-bar indicator reads /health on load and every 30 s, so it shows the real state. */
export function useBackendState(): BackendState {
  const [state, setState] = useState<BackendState>("checking");
  useEffect(() => {
    const controller = new AbortController();
    const run = () => checkHealth(controller.signal).then((next) => { if (!controller.signal.aborted) setState(next); });
    void run();
    const timer = setInterval(run, CHECK_EVERY_MS);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  return state;
}
