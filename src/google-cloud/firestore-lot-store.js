/**
 * Lot heads and lot revisions (design 2.7, ADR-0003).
 *
 * `lot_heads/{lotId}` holds the lot in progress; `lot_revisions/{jobId}` holds
 * one planned draft. Each operation that reads one document and writes another
 * runs in a single transaction, so a changed condition and the revision it
 * replaces are never saved apart. Nothing here calls Gemini, BigQuery or
 * Storage: those calls stay outside the transactions (design 3.1).
 *
 * Refusals are returned as `{ ok: false, code }`. A Firestore fault, or a
 * stored document that fails its schema, throws a FirestoreRestError with code
 * SERVICE_UNAVAILABLE, so the caller fails closed.
 */

import { createCloudRunAccessTokenProvider } from "./bigquery-read-client.js";
import {
  createFirestoreRestClient,
  currentDocumentPrecondition,
  encodeDocument,
  FirestoreRestError,
  parseDocument,
} from "./firestore-rest.js";
import { JobIdSchema } from "../schemas.js";
import {
  BASE_TIMESTAMP_FIELDS,
  LotHeadDocSchema,
  LotIdSchema,
  LotRevisionDocSchema,
  ProvenancedValueSchema,
  SessionIdSchema,
  Sha256HexSchema,
  STATE_SCHEMA_VERSION,
} from "../state-schemas.js";

export const LOT_HEAD_COLLECTION = "lot_heads";
export const LOT_REVISION_COLLECTION = "lot_revisions";
// Design 2.0: heads expire 30 days after the last write, revisions 180 days after creation.
const HEAD_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const REVISION_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
// Longer than the 120 s Cloud Run request timeout (design 3.2).
export const APPROVAL_LEASE_MS = 130_000;
const REVISION_TIMESTAMPS = [...BASE_TIMESTAMP_FIELDS, "approvingLeaseExpiresAt", "approvedAt"];
const ConditionsSchema = ProvenancedValueSchema.array().max(5).refine(
  (list) => new Set(list.map((entry) => entry.field)).size === list.length,
  "Each condition field may appear once.",
);

function unavailable(message) {
  return new FirestoreRestError("SERVICE_UNAVAILABLE", message);
}

const refuse = (code, extra = {}) => ({ ok: false, code, ...extra });

function check(schema, input, what) {
  if (!schema.safeParse(input).success) throw new TypeError(`${what} is invalid.`);
}

/** The first field whose value differs from the frozen copy, or undefined. */
function firstChange(frozen, next) {
  for (const entry of next) {
    const before = frozen.find((candidate) => candidate.field === entry.field);
    if (before?.value !== entry.value) {
      return { field: entry.field, from: before?.value ?? "not set", to: entry.value, provenance: entry.provenance };
    }
  }
  return undefined;
}

function mergeConditions(existing, incoming) {
  const replaced = existing.map((old) => incoming.find((entry) => entry.field === old.field) ?? old);
  return [...replaced, ...incoming.filter((entry) => !existing.some((old) => old.field === entry.field))];
}

export function createFirestoreLotStore({
  projectId, database = "(default)", fetchImpl = fetch, tokenProvider,
  now = Date.now, maxAttempts = 3, timeoutMs = 5000,
} = {}) {
  if (database !== "(default)" || typeof now !== "function" ||
      !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) {
    throw new TypeError("The default Firestore database and bounded settings are required.");
  }
  const firestore = createFirestoreRestClient({ projectId, database, fetchImpl });
  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });
  const { databaseName, documentsUrl } = firestore;
  const documentName = (collection, id) => `${databaseName}/documents/${collection}/${id}`;

  async function withToken(signal, work) {
    const bounded = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    let token;
    try {
      token = await provideToken({ signal: bounded });
    } catch {
      throw unavailable("Cloud Run workload identity is unavailable.");
    }
    if (typeof token !== "string" || token.length === 0 || bounded.aborted) {
      throw unavailable("Cloud Run workload identity is unavailable.");
    }
    return work({ token, signal: bounded });
  }

  async function readDoc(collection, id, schema, { token, signal, transaction }) {
    const query = transaction ? `?transaction=${encodeURIComponent(transaction)}` : "";
    const read = await firestore.request(`${documentsUrl}/${collection}/${encodeURIComponent(id)}${query}`, { token, signal });
    if (read.status === 404) return null;
    if (!read.ok || read.payload?.name !== documentName(collection, id) ||
        typeof read.payload.updateTime !== "string" || read.payload.updateTime.length === 0) {
      throw unavailable("Firestore did not return the lot record.");
    }
    return { doc: parseDocument(schema, read.payload), updateTime: read.payload.updateTime };
  }

  const readHead = (lotId, context) => readDoc(LOT_HEAD_COLLECTION, lotId, LotHeadDocSchema, context);
  const readRevision = (jobId, context) => readDoc(LOT_REVISION_COLLECTION, jobId, LotRevisionDocSchema, context);

  const iso = (instant) => new Date(instant).toISOString();

  function headWrite(doc, read, instant) {
    return {
      update: {
        name: documentName(LOT_HEAD_COLLECTION, doc.lotId),
        fields: encodeDocument(LotHeadDocSchema, {
          ...doc, updatedAt: iso(instant), expiresAt: iso(instant + HEAD_RETENTION_MS),
        }, { timestamps: BASE_TIMESTAMP_FIELDS }),
      },
      currentDocument: currentDocumentPrecondition(read ? read.updateTime : null),
    };
  }

  function revisionWrite(doc, read, instant) {
    return {
      update: {
        name: documentName(LOT_REVISION_COLLECTION, doc.jobId),
        fields: encodeDocument(LotRevisionDocSchema, { ...doc, updatedAt: iso(instant) },
          { timestamps: REVISION_TIMESTAMPS }),
      },
      currentDocument: currentDocumentPrecondition(read ? read.updateTime : null),
    };
  }

  function newHead(lotId, ownerSessionId, instant, fields = {}) {
    return {
      schemaVersion: STATE_SCHEMA_VERSION, createdAt: iso(instant), updatedAt: iso(instant), expiresAt: iso(instant),
      lotId, ownerSessionId, reviewId: null, orderRef: null, draftConditions: [], conditionsFingerprint: null,
      currentRevision: 0, currentJobId: null, stage: "conditions", version: 0, ...fields,
    };
  }

  /**
   * Runs `attempt` in a read-write transaction and retries a definite
   * non-commit (ABORTED or a failed precondition). Any other commit failure
   * may have been applied, so it is reported as unavailable and not retried.
   */
  async function transact(signal, attempt) {
    return withToken(signal, async (context) => {
      for (let round = 0; round < maxAttempts; round += 1) {
        let transaction;
        let commitIssued = false;
        try {
          transaction = await firestore.beginTransaction(context);
          const step = await attempt({ ...context, transaction }, now());
          if (step.writes === undefined) {
            await firestore.rollback({ transaction, ...context }).catch(() => false);
            return step.result;
          }
          commitIssued = true;
          const committed = await firestore.commit({ transaction, writes: step.writes, ...context });
          if (committed.aborted || committed.preconditionFailed) continue;
          if (!committed.ok || !Array.isArray(committed.payload?.writeResults) ||
              committed.payload.writeResults.length !== step.writes.length) {
            throw unavailable("Firestore did not confirm the lot write.");
          }
          return step.result;
        } catch (error) {
          if (transaction && !commitIssued && !context.signal.aborted) {
            await firestore.rollback({ transaction, ...context }).catch(() => false);
          }
          throw error;
        }
      }
      throw unavailable("The lot record kept changing; try again.");
    });
  }

  return Object.freeze({
    /**
     * Saves conditions on the head, merged by field. If a CURRENT revision's
     * frozen conditions differ, that revision is superseded in the same commit.
     */
    async saveConditions({ lotId, ownerSessionId, conditions, byRole, orderRef, reviewId, signal } = {}) {
      check(LotIdSchema, lotId, "The lot ID");
      check(SessionIdSchema, ownerSessionId, "The session ID");
      check(ConditionsSchema, conditions, "The conditions");
      if (typeof byRole !== "string" || byRole.length === 0 || byRole.length > 64) throw new TypeError("The role is invalid.");
      return transact(signal, async (context, instant) => {
        const head = await readHead(lotId, context);
        if (head && head.doc.ownerSessionId !== ownerSessionId) return { result: refuse("LOT_OWNER_MISMATCH") };
        const revision = head?.doc.currentJobId ? await readRevision(head.doc.currentJobId, context) : null;
        const draft = mergeConditions(head?.doc.draftConditions ?? [], conditions);
        const change = revision && ["CURRENT", "APPROVING"].includes(revision.doc.status)
          ? firstChange(revision.doc.conditions, draft)
          : undefined;
        if (change && revision.doc.status === "APPROVING") return { result: refuse("APPROVAL_IN_PROGRESS") };
        const base = head?.doc ?? newHead(lotId, ownerSessionId, instant);
        const nextHead = {
          ...base,
          draftConditions: draft,
          ...(orderRef === undefined ? {} : { orderRef }),
          ...(reviewId === undefined ? {} : { reviewId }),
          stage: change || ["order_review"].includes(base.stage) ? "conditions" : base.stage,
          version: head ? base.version + 1 : 0,
        };
        const reason = change ? { ...change, byRole } : null;
        const writes = [headWrite(nextHead, head, instant)];
        if (change) {
          writes.push(revisionWrite({
            ...revision.doc, status: "SUPERSEDED", supersededBy: null, supersededReason: reason,
          }, revision, instant));
        }
        return {
          writes,
          result: {
            ok: true,
            head: nextHead,
            superseded: change ? { jobId: revision.doc.jobId, number: revision.doc.number, reason } : null,
          },
        };
      });
    },

    /** The head and its current revision, or null when the lot is absent or another session's. */
    async getLot({ lotId, ownerSessionId, signal } = {}) {
      check(LotIdSchema, lotId, "The lot ID");
      check(SessionIdSchema, ownerSessionId, "The session ID");
      return withToken(signal, async (context) => {
        const head = await readHead(lotId, context);
        if (!head || head.doc.ownerSessionId !== ownerSessionId) return null;
        const revision = head.doc.currentJobId ? await readRevision(head.doc.currentJobId, context) : null;
        return { head: head.doc, revision: revision?.doc ?? null };
      });
    },

    async getRevision({ jobId, signal } = {}) {
      check(JobIdSchema, jobId, "The job ID");
      return withToken(signal, async (context) => (await readRevision(jobId, context))?.doc ?? null);
    },

    /** Registers a PENDING revision before planning. A retry for the same job reuses it. */
    async registerPending({ lotId, ownerSessionId, jobId, requestFingerprint, conditions, signal } = {}) {
      check(LotIdSchema, lotId, "The lot ID");
      check(SessionIdSchema, ownerSessionId, "The session ID");
      check(JobIdSchema, jobId, "The job ID");
      check(Sha256HexSchema, requestFingerprint, "The request fingerprint");
      check(ConditionsSchema, conditions, "The conditions");
      return transact(signal, async (context, instant) => {
        const [head, existing] = await Promise.all([readHead(lotId, context), readRevision(jobId, context)]);
        if (head && head.doc.ownerSessionId !== ownerSessionId) return { result: refuse("LOT_OWNER_MISMATCH") };
        if (existing) {
          return existing.doc.lotId === lotId && existing.doc.requestFingerprint === requestFingerprint
            ? { result: { ok: true, revision: existing.doc, reused: true } }
            : { result: refuse("REVISION_CONFLICT") };
        }
        const number = (head?.doc.currentRevision ?? 0) + 1;
        const base = head?.doc ?? newHead(lotId, ownerSessionId, instant, { draftConditions: conditions });
        const revision = {
          schemaVersion: STATE_SCHEMA_VERSION, createdAt: iso(instant), updatedAt: iso(instant),
          expiresAt: iso(instant + REVISION_RETENTION_MS),
          jobId, lotId, number, status: "PENDING", requestFingerprint, revisionFingerprint: null, conditions,
          supersededBy: null, supersededReason: null, approvingLeaseExpiresAt: null, approvedAt: null,
        };
        const nextHead = { ...base, currentRevision: number, stage: "planning", version: head ? base.version + 1 : 0 };
        return {
          writes: [headWrite(nextHead, head, instant), revisionWrite(revision, null, instant)],
          result: { ok: true, revision, reused: false },
        };
      });
    },

    /** PENDING becomes CURRENT, and the previous CURRENT revision is superseded, in one commit. */
    async makeCurrent({ lotId, jobId, revisionFingerprint, signal } = {}) {
      check(LotIdSchema, lotId, "The lot ID");
      check(JobIdSchema, jobId, "The job ID");
      check(Sha256HexSchema, revisionFingerprint, "The revision fingerprint");
      return transact(signal, async (context, instant) => {
        const [head, revision] = await Promise.all([readHead(lotId, context), readRevision(jobId, context)]);
        if (!head || !revision || revision.doc.lotId !== lotId) return { result: refuse("REVISION_NOT_REGISTERED") };
        const doc = revision.doc;
        if (doc.status === "CURRENT" && doc.revisionFingerprint === revisionFingerprint) {
          return { result: { ok: true, revision: doc } };
        }
        if (doc.status !== "PENDING") return { result: refuse("REVISION_CONFLICT") };
        const previousId = head.doc.currentJobId;
        const previous = previousId && previousId !== jobId ? await readRevision(previousId, context) : null;
        const current = { ...doc, status: "CURRENT", revisionFingerprint };
        const writes = [
          headWrite({ ...head.doc, currentJobId: jobId, stage: "draft_review", version: head.doc.version + 1 }, head, instant),
          revisionWrite(current, revision, instant),
        ];
        // An edit may already have superseded it; that reason stays.
        if (previous?.doc.status === "CURRENT") {
          writes.push(revisionWrite({ ...previous.doc, status: "SUPERSEDED", supersededBy: jobId }, previous, instant));
        }
        return { writes, result: { ok: true, revision: current } };
      });
    },

    async markFailed({ lotId, jobId, signal } = {}) {
      check(LotIdSchema, lotId, "The lot ID");
      check(JobIdSchema, jobId, "The job ID");
      return transact(signal, async (context, instant) => {
        const revision = await readRevision(jobId, context);
        if (!revision || revision.doc.lotId !== lotId || revision.doc.status !== "PENDING") {
          return { result: { ok: true } };
        }
        return {
          writes: [revisionWrite({ ...revision.doc, status: "FAILED" }, revision, instant)],
          result: { ok: true },
        };
      });
    },

    /**
     * The approve guard (design 4.3, step 3). A pass moves the revision to
     * APPROVING under a lease; an already APPROVED revision passes without a write.
     */
    async beginApproval({ jobId, revisionFingerprint, signal } = {}) {
      check(JobIdSchema, jobId, "The job ID");
      check(Sha256HexSchema, revisionFingerprint, "The revision fingerprint");
      return transact(signal, async (context, instant) => {
        const revision = await readRevision(jobId, context);
        if (!revision || ["PENDING", "FAILED"].includes(revision.doc.status)) {
          return { result: refuse("REVISION_NOT_REGISTERED") };
        }
        const doc = revision.doc;
        const head = await readHead(doc.lotId, context);
        if (doc.status === "SUPERSEDED") {
          const replacedBy = head && head.doc.currentJobId !== jobId ? head.doc : null;
          return { result: refuse("REVISION_SUPERSEDED", {
            currentJobId: replacedBy?.currentJobId ?? null,
            currentRevision: replacedBy ? replacedBy.currentRevision : null,
          }) };
        }
        if (doc.status === "APPROVING" && Date.parse(doc.approvingLeaseExpiresAt) > instant) {
          return { result: refuse("APPROVAL_IN_PROGRESS") };
        }
        if (doc.revisionFingerprint !== revisionFingerprint ||
            (doc.status !== "APPROVED" && head?.doc.currentJobId !== jobId)) {
          return { result: refuse("REVISION_FINGERPRINT_MISMATCH") };
        }
        if (doc.status === "APPROVED") return { result: { ok: true, alreadyApproved: true } };
        return {
          writes: [revisionWrite({
            ...doc, status: "APPROVING", approvingLeaseExpiresAt: iso(instant + APPROVAL_LEASE_MS),
          }, revision, instant)],
          result: { ok: true, alreadyApproved: false },
        };
      });
    },

    /** APPROVING becomes APPROVED, or returns to CURRENT when the approval failed. */
    async finishApproval({ jobId, approved, signal } = {}) {
      check(JobIdSchema, jobId, "The job ID");
      if (typeof approved !== "boolean") throw new TypeError("The approval outcome is invalid.");
      return transact(signal, async (context, instant) => {
        const revision = await readRevision(jobId, context);
        if (!revision) return { result: refuse("REVISION_NOT_REGISTERED") };
        const doc = revision.doc;
        if (doc.status === "APPROVED" && approved) return { result: { ok: true } };
        if (doc.status !== "APPROVING") return { result: refuse("REVISION_CONFLICT") };
        if (!approved) {
          return {
            writes: [revisionWrite({ ...doc, status: "CURRENT", approvingLeaseExpiresAt: null }, revision, instant)],
            result: { ok: true },
          };
        }
        const head = await readHead(doc.lotId, context);
        const writes = [revisionWrite({
          ...doc, status: "APPROVED", approvingLeaseExpiresAt: null, approvedAt: iso(instant),
        }, revision, instant)];
        if (head) writes.push(headWrite({ ...head.doc, stage: "approved", version: head.doc.version + 1 }, head, instant));
        return { writes, result: { ok: true } };
      });
    },
  });
}
