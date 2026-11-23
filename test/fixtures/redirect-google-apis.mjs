// Loaded with `node --import` into an app process under test. Requests to the
// Google APIs the idempotency path uses go to a local fake instead, so two app
// processes can share one fake Firestore and one fake job_sheets table. Every
// other request is left alone.
const target = process.env.TEST_GOOGLE_APIS_ORIGIN;
const redirectedHosts = new Set([
  "firestore.googleapis.com",
  "bigquery.googleapis.com",
  "metadata.google.internal",
]);
const realFetch = globalThis.fetch;

globalThis.fetch = (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!target || !redirectedHosts.has(url.hostname)) return realFetch(input, init);
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  return realFetch(target, { ...init, headers: { ...headers, "x-original-url": url.href } });
};
