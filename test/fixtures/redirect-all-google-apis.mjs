// Loaded with `node --import` into an app process under test. Every request to a
// Google API host goes to a local fake that answers metadata tokens, Firestore,
// Cloud Storage and Vertex AI, so a Gemini call can run end to end with no network.
const target = process.env.TEST_GOOGLE_APIS_ORIGIN;
const realFetch = globalThis.fetch;
const isGoogleHost = (hostname) => hostname === "metadata.google.internal" || hostname.endsWith(".googleapis.com");

globalThis.fetch = (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!target || !isGoogleHost(url.hostname)) return realFetch(input, init);
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  return realFetch(target, { ...init, headers: { ...headers, "x-original-url": url.href } });
};
