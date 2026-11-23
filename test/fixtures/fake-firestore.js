// An in-process stand-in for the Firestore REST endpoints the stores use:
// createDocument (POST ?documentId=), get (GET), patch (PATCH) and delete
// (DELETE) with a currentDocument.exists=false or currentDocument.updateTime
// precondition and an optional update mask, and runQuery over one
// subcollection. Several clients can share one instance, which is how the
// tests model two Cloud Run instances reading the same database.
export const FAKE_PROJECT_ID = "prepagent-hack";
const ROOT = `https://firestore.googleapis.com/v1/projects/${FAKE_PROJECT_ID}/databases/(default)/documents`;
const NAME_ROOT = `projects/${FAKE_PROJECT_ID}/databases/(default)/documents`;

function respond(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

function relativePath(key) {
  return key.startsWith(`${NAME_ROOT}/`) ? key.slice(NAME_ROOT.length + 1) : key;
}

// Keys are paths under /documents ("traces/<runId>"). A full document name,
// as documentName returns, reaches the same entry.
class DocumentMap extends Map {
  get(key) { return super.get(relativePath(key)); }
  has(key) { return super.has(relativePath(key)); }
  set(key, value) { return super.set(relativePath(key), value); }
  delete(key) { return super.delete(relativePath(key)); }
}

function integerField(fields, name) {
  const raw = fields?.[name]?.integerValue;
  return raw === undefined ? undefined : Number(raw);
}

export function createFakeFirestore({ failWhen = () => false } = {}) {
  const documents = new DocumentMap();
  const calls = [];
  let tick = 0;

  function nextTime() {
    tick += 1;
    return new Date(Date.UTC(2026, 11, 4, 0, 0, tick)).toISOString();
  }

  // Orders by one or more fields (timestamp, integer or string values, plus __name__) and
  // honours a startAt cursor. A query with no `where` returns the whole collection.
  function sortValue(path, stored, field) {
    if (field === "__name__") return `${NAME_ROOT}/${path}`;
    const value = stored.fields?.[field];
    return value?.timestampValue ?? value?.stringValue ?? Number(value?.integerValue);
  }

  function runQuery(parent, body) {
    const { structuredQuery } = JSON.parse(body);
    const prefix = `${parent}/${structuredQuery.from[0].collectionId}/`;
    const filter = structuredQuery.where?.fieldFilter;
    const after = filter ? Number(filter.value.integerValue) : undefined;
    const orders = structuredQuery.orderBy?.length ? structuredQuery.orderBy : [{ field: { fieldPath: "sequence" } }];
    const sign = ({ direction }) => (direction === "DESCENDING" ? -1 : 1);
    // Negative when `a` sorts before `b` in the query order.
    const compare = (left, right) => {
      for (const order of orders) {
        const a = sortValue(left.path, left.stored, order.field.fieldPath);
        const b = sortValue(right.path, right.stored, order.field.fieldPath);
        if (a !== b) return sign(order) * (a < b ? -1 : 1);
      }
      return 0;
    };
    const cursor = structuredQuery.startAt;
    const atOrAfterCursor = (entry) => {
      if (!cursor) return true;
      for (const [index, order] of orders.entries()) {
        const value = cursor.values[index];
        const wanted = value.timestampValue ?? value.referenceValue ?? value.stringValue;
        const own = sortValue(entry.path, entry.stored, order.field.fieldPath);
        if (own !== wanted) return sign(order) * (own < wanted ? -1 : 1) > 0;
      }
      return cursor.before === true;
    };
    const matches = [...documents.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
      .map(([path, stored]) => ({ path, stored }))
      .filter(({ stored }) => after === undefined || integerField(stored.fields, "sequence") > after)
      .sort(compare)
      .filter(atOrAfterCursor)
      .slice(0, structuredQuery.limit)
      .map(({ stored }) => stored);
    const readTime = nextTime();
    return respond(200, matches.length
      ? matches.map((stored) => ({ document: structuredClone(stored), readTime }))
      : [{ readTime }]);
  }

  async function fetchImpl(url, options = {}) {
    const method = options.method ?? "GET";
    const parsed = new URL(url);
    const path = url.startsWith(`${ROOT}/`)
      ? decodeURIComponent(parsed.pathname.slice(new URL(ROOT).pathname.length + 1))
      : undefined;
    calls.push({
      url,
      method,
      body: options.body === undefined ? undefined : JSON.parse(options.body),
      path,
      search: parsed.search,
      authorization: options.headers?.Authorization,
    });
    if (options.signal?.aborted) {
      throw Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
    }
    if (path === undefined) throw new Error(`unexpected request to ${url}`);
    if (failWhen({ method, path })) throw new TypeError("fetch failed");

    if (method === "POST" && path.endsWith(":runQuery")) {
      return runQuery(path.slice(0, -":runQuery".length), options.body);
    }
    if (method === "POST") {
      const documentPath = `${path}/${parsed.searchParams.get("documentId")}`;
      if (documents.has(documentPath)) {
        return respond(409, { error: { code: 409, status: "ALREADY_EXISTS" } });
      }
      const time = nextTime();
      const stored = {
        name: `${NAME_ROOT}/${documentPath}`,
        fields: structuredClone(JSON.parse(options.body).fields),
        createTime: time,
        updateTime: time,
      };
      documents.set(documentPath, stored);
      return respond(200, structuredClone(stored));
    }
    if (method === "PATCH" || method === "DELETE") {
      const stored = documents.get(path);
      if (stored && parsed.searchParams.get("currentDocument.exists") === "false") {
        return respond(409, { error: { code: 409, status: "ALREADY_EXISTS" } });
      }
      const expectedVersion = parsed.searchParams.get("currentDocument.updateTime");
      if (!stored && (method === "DELETE" || expectedVersion !== null)) {
        return respond(404, { error: { code: 404, status: "NOT_FOUND" } });
      }
      if (expectedVersion !== null && expectedVersion !== stored.updateTime) {
        return respond(400, { error: { code: 400, status: "FAILED_PRECONDITION" } });
      }
      if (method === "DELETE") {
        documents.delete(path);
        return respond(200, {});
      }
      const patch = JSON.parse(options.body).fields;
      const mask = parsed.searchParams.getAll("updateMask.fieldPaths");
      // With a mask, only the masked fields change, and a masked field missing from the body is removed.
      const fields = mask.length === 0 ? structuredClone(patch) : structuredClone(stored?.fields ?? {});
      for (const key of mask) {
        if (key in patch) fields[key] = structuredClone(patch[key]);
        else delete fields[key];
      }
      const time = nextTime();
      const updated = {
        name: `${NAME_ROOT}/${path}`,
        fields,
        createTime: stored?.createTime ?? time,
        updateTime: time,
      };
      documents.set(path, updated);
      return respond(200, structuredClone(updated));
    }
    if (method === "GET") {
      const stored = documents.get(path);
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
