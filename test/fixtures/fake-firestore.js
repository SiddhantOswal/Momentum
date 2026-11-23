// An in-process stand-in for the Firestore REST document endpoints the
// stores use: createDocument (POST ?documentId=), get (GET), and patch
// (PATCH) and delete (DELETE) with a currentDocument.updateTime precondition
// and an optional update mask. Several
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
    if (method === "PATCH" || method === "DELETE") {
      const name = `${NAME_ROOT}/${path}`;
      const stored = documents.get(name);
      if (!stored) return respond(404, { error: { code: 404, status: "NOT_FOUND" } });
      const expectedVersion = parsed.searchParams.get("currentDocument.updateTime");
      if (expectedVersion !== null && expectedVersion !== stored.updateTime) {
        return respond(400, { error: { code: 400, status: "FAILED_PRECONDITION" } });
      }
      if (method === "DELETE") {
        documents.delete(name);
        return respond(200, {});
      }
      const patch = JSON.parse(options.body).fields;
      const mask = parsed.searchParams.getAll("updateMask.fieldPaths");
      // With a mask, only the masked fields change, and a masked field missing from the body is removed.
      const fields = mask.length === 0 ? structuredClone(patch) : structuredClone(stored.fields);
      for (const key of mask) {
        if (key in patch) fields[key] = structuredClone(patch[key]);
        else delete fields[key];
      }
      tick += 1;
      const updated = { ...stored, fields, updateTime: new Date(Date.UTC(2026, 11, 4, 0, 0, tick)).toISOString() };
      documents.set(name, updated);
      return respond(200, structuredClone(updated));
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
