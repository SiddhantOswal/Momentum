// Live Pune weather from the Google Weather API, cached for 10 minutes so many open screens
// cost at most six calls an hour. Disabled unless WEATHER_API_KEY is set.
export const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;

export function createWeatherCache() {
  let entry;
  return {
    get: () => entry,
    set: (next) => { entry = next; },
  };
}

export async function readWeather(_input, { signal, weatherProvider, weatherCache, now }) {
  if (!weatherProvider) return { ok: false, status: 503, error: { code: "SERVICE_UNAVAILABLE", message: "Live weather is not configured." } };
  let cached = weatherCache.get();
  if (!cached || now() - cached.at > WEATHER_CACHE_TTL_MS) {
    const reading = await weatherProvider({ signal }).catch(() => undefined);
    if (reading?.ok) {
      cached = { at: now(), reading };
      weatherCache.set(cached);
    } else if (!cached) {
      return { ok: false, status: 503, error: { code: "SERVICE_UNAVAILABLE", message: "Live weather is unavailable right now." } };
    }
  }
  return { ...cached.reading, location: "Pune" };
}
