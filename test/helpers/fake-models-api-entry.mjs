import { fakeFirestore } from "../fixtures/fake-firestore-transactions.js";

// Starts the real server with a fake global fetch, so the model version check
// reads FAKE_MODEL_ETAGS instead of BigQuery and nothing leaves the machine.
// Firestore goes to the in-memory fake so budget-v2 demo sessions can be issued.
const firestore = fakeFirestore();
const etags = JSON.parse(process.env.FAKE_MODEL_ETAGS);
const MODELS = /^https:\/\/bigquery\.googleapis\.com\/bigquery\/v2\/projects\/prepagent-hack\/datasets\/prepagent\/models\/(m2_[a-z]+)$/;

globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith("https://firestore.googleapis.com/")) return firestore.fetchImpl(url, init);
  if (url.startsWith("http://metadata.google.internal/")) return Response.json({ access_token: "fake-entry-token" });
  const model = MODELS.exec(url)?.[1];
  if (model && typeof etags[model] === "string") return Response.json({ etag: etags[model] });
  throw new TypeError("fetch failed");
};

await import("../../index.mjs");
