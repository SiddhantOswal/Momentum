// An in-process stand-in for the Firestore REST document endpoints the
// stores use: createDocument (POST ?documentId=) and get (GET). Several
// clients can share one instance, which is how the tests model two Cloud Run
// instances reading the same database.
const ROOT = "https://firestore.googleapis.com/v1/projects/prepagent-hack/databases/(default)/documents";
const NAME_ROOT = "projects/prepagent-hack/databases/(default)/documents";

function respond(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

export function createFakeFirestore() {
  const documents = new Map();
  const calls = [];
  let tick = 0;

  async function fetchImpl(url, options = {}) {
    const method = options.method ?? "GET";
    calls.push({ url, method, body: options.body === undefined ? undefined : JSON.parse(options.body) });
    if (options.signal?.aborted) {
      throw Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
    }
    const parsed = new URL(url);
    if (!url.startsWith(`${ROOT}/`)) throw new Error(`unexpected request to ${url}`);
    const path = decodeURIComponent(parsed.pathname.slice(new URL(ROOT).pathname.length + 1));

    if (method === "POST") {
      const documentId = parsed.searchParams.get("documentId");
      const name = `${NAME_ROOT}/${path}/${documentId}`;
      if (documents.has(name)) {
        return respond(409, { error: { code: 409, status: "ALREADY_EXISTS" } });
      }
      tick += 1;
      const time = new Date(Date.UTC(2026, 11, 4, 0, 0, tick)).toISOString();
      const stored = { name, fields: structuredClone(JSON.parse(options.body).fields), createTime: time, updateTime: time };
      documents.set(name, stored);
      return respond(200, structuredClone(stored));
    }
    if (method === "GET") {
      const stored = documents.get(`${NAME_ROOT}/${path}`);
      if (!stored) return respond(404, { error: { code: 404, status: "NOT_FOUND" } });
      return respond(200, structuredClone(stored));
    }
    throw new Error(`unexpected ${method} ${url}`);
  }

  return {
    fetchImpl,
    calls,
    documents,
    documentName: (collection, id) => `${NAME_ROOT}/${collection}/${id}`,
  };
}
