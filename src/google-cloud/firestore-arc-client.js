/**
 * Schema-checked document calls shared by the Arc session and task-run stores.
 *
 * Every write is conditional: create-only (the document must not exist) or
 * pinned to the `updateTime` that was read, so a lost race fails instead of
 * overwriting. A Firestore fault, or a stored document that fails its schema,
 * is a FirestoreRestError with code SERVICE_UNAVAILABLE and never an absent
 * document (design 3.1, fail closed).
 */

import { createCloudRunAccessTokenProvider } from "./bigquery-read-client.js";
import {
  conditionalWriteUrl,
  createFirestoreRestClient,
  encodeDocument,
  FirestoreRestError,
  isPreconditionFailure,
  parseDocument,
  readJson,
} from "./firestore-rest.js";

export function unavailable(message) {
  return new FirestoreRestError("SERVICE_UNAVAILABLE", message);
}

export function createArcFirestore({
  projectId,
  database = "(default)",
  fetchImpl = fetch,
  tokenProvider,
  timeoutMs = 5000,
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) {
    throw new TypeError("The Firestore request timeout must be between 1 and 10000 ms.");
  }
  const firestore = createFirestoreRestClient({ projectId, database, fetchImpl });
  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });
  const { databaseName, documentsUrl } = firestore;
  const documentName = (path) => `${databaseName}/documents/${path}`;
  const documentUrl = (path) => `${documentsUrl}/${path.split("/").map(encodeURIComponent).join("/")}`;

  async function send(url, { method, body, signal } = {}) {
    const bounded = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs);
    let token;
    try {
      token = await provideToken({ signal: bounded });
    } catch (error) {
      if (signal?.aborted) throw error;
      token = undefined;
    }
    if (typeof token !== "string" || token.length === 0) {
      throw new FirestoreRestError("CLOUD_IDENTITY_UNAVAILABLE", "Cloud Run workload identity is unavailable.");
    }
    try {
      return await firestore.send(url, { method, body, token, signal: bounded });
    } catch (error) {
      if (signal?.aborted || error instanceof FirestoreRestError) throw error;
      throw unavailable("Cloud Firestore did not answer in time.");
    }
  }

  return Object.freeze({
    databaseName,
    documentName,

    /** The decoded document and its version, or null when Firestore says it does not exist. */
    async read(path, schema, { signal } = {}) {
      const response = await send(documentUrl(path), { signal });
      if (response.status === 404) return null;
      const payload = await readJson(response);
      if (!response.ok || payload?.name !== documentName(path) ||
          typeof payload.updateTime !== "string" || payload.updateTime.length === 0) {
        throw unavailable("Firestore did not return the Arc record.");
      }
      return { doc: parseDocument(schema, payload), updateTime: payload.updateTime };
    },

    /** Create-only. Returns false when the document already exists. */
    async create(path, schema, value, { timestamps, signal } = {}) {
      const slash = path.lastIndexOf("/");
      const fields = encodeDocument(schema, value, { timestamps });
      const response = await send(
        `${documentUrl(path.slice(0, slash))}?documentId=${encodeURIComponent(path.slice(slash + 1))}`,
        { method: "POST", body: { fields }, signal },
      );
      if (response.ok) return true;
      if (await isPreconditionFailure(response)) return false;
      throw unavailable("Firestore did not store the Arc record.");
    },

    /** Replaces the document if it is still the version that was read. Returns false when it changed. */
    async replace(path, schema, value, updateTime, { timestamps, signal } = {}) {
      const fields = encodeDocument(schema, value, { timestamps });
      const response = await send(conditionalWriteUrl(documentUrl(path), updateTime), {
        method: "PATCH",
        body: { fields },
        signal,
      });
      if (response.ok) return true;
      if (response.status === 404 || await isPreconditionFailure(response)) return false;
      throw unavailable("Firestore did not store the Arc record.");
    },

    async remove(path, { signal } = {}) {
      const response = await send(documentUrl(path), { method: "DELETE", signal });
      if (!response.ok && response.status !== 404) throw unavailable("Firestore did not delete the Arc record.");
    },

    /** Runs a structured query under `parentPath` and returns the documents it matched, in order. */
    async query(parentPath, structuredQuery, schema, { signal } = {}) {
      const response = await send(`${documentUrl(parentPath)}:runQuery`, {
        method: "POST",
        body: { structuredQuery },
        signal,
      });
      const payload = await readJson(response);
      if (!response.ok || !Array.isArray(payload)) throw unavailable("Firestore did not return the Arc records.");
      return payload.filter((entry) => entry?.document).map(({ document }) => ({
        doc: parseDocument(schema, document),
        name: document.name,
      }));
    },
  });
}
