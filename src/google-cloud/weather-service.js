import { z } from "zod";
import weatherConfig from "../../config/weather.json" with { type: "json" };

// Google Maps Platform Weather API, current conditions only. This adapter is a
// fallback source for ambient humidity and temperature; it is never created
// unless WEATHER_API_KEY is set (injected at runtime from Secret Manager
// secret momentum-weather-api-key). The key travels in the standard Google API
// key header (X-Goog-Api-Key) rather than the ?key= query parameter so it never
// appears in URLs or request logs.
// Response fields used (others such as weatherCondition are ignored), e.g.
// {"currentTime":"2026-11-19T21:02:17.248Z","relativeHumidity":65,
//  "temperature":{"unit":"CELSIUS","degrees":17.8}, ...}
const CurrentConditionsSchema = z.object({
  currentTime: z.iso.datetime({ offset: true }),
  relativeHumidity: z.number().finite().min(0).max(100),
  temperature: z.object({
    degrees: z.number().finite(),
    unit: z.literal("CELSIUS"),
  }),
});

function unavailable(message = "Weather conditions are unavailable.") {
  return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message } };
}

export function createWeatherProvider({
  apiKey,
  fetchImpl = fetch,
  endpoint = weatherConfig.endpoint,
  location = weatherConfig.location,
  timeoutMs = weatherConfig.timeoutMs,
} = {}) {
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new TypeError("A weather API key is required.");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required.");
  }
  if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) {
    throw new TypeError("Weather location coordinates are required.");
  }
  const url = new URL(endpoint);
  if (url.protocol !== "https:") {
    throw new TypeError("The weather endpoint must use HTTPS.");
  }
  url.searchParams.set("location.latitude", String(location.latitude));
  url.searchParams.set("location.longitude", String(location.longitude));
  url.searchParams.set("unitsSystem", "METRIC");

  return async function getCurrentWeather({ signal } = {}) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    const timeout = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response;
    try {
      response = await fetchImpl(url.toString(), {
        method: "GET",
        headers: { "X-Goog-Api-Key": apiKey.trim(), Accept: "application/json" },
        signal: combined,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      return unavailable();
    }
    if (!response?.ok) return unavailable();
    let body;
    try {
      body = await response.json();
    } catch {
      return unavailable("Weather service returned an unreadable response.");
    }
    const parsed = CurrentConditionsSchema.safeParse(body);
    if (!parsed.success) {
      return unavailable("Weather service returned an unexpected response.");
    }
    return {
      ok: true,
      source: "google-maps-weather",
      ambientRhPct: parsed.data.relativeHumidity,
      ambientTempC: parsed.data.temperature.degrees,
      observedAt: parsed.data.currentTime,
    };
  };
}

/** Returns a weather provider only when the API key env var is set. */
export function createWeatherProviderFromEnv(env = process.env, options = {}) {
  const apiKey = env?.[weatherConfig.apiKeyEnv];
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) return undefined;
  return createWeatherProvider({ apiKey, ...options });
}
