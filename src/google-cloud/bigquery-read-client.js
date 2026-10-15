const BIGQUERY_API = "https://bigquery.googleapis.com/bigquery/v2";
const CLOUD_RUN_METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

export const DEFAULT_MAX_BYTES_BILLED = 50 * 1024 * 1024;
const DEFAULT_QUERY_WAIT_MS = 50_000;
const DEFAULT_POLL_INTERVAL_MS = 250;

const MUTATING_SQL = /\b(CREATE|INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|TRUNCATE|CALL|EXPORT|LOAD)\b/i;

export class BigQueryReadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BigQueryReadError";
    this.code = code;
  }
}

function waitForPoll(ms, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener("abort", abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function scrubSql(sql) {
  return sql
    .replace(/--[^\n\r]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:''|\\.|[^'\\])*'/g, "''");
}

function assertReadOnlySql(sql) {
  if (typeof sql !== "string") {
    throw new BigQueryReadError("READ_ONLY_QUERY_REQUIRED", "Only SELECT queries are allowed.");
  }

  // Om's canonical optimizer is a read-only script: two exact existence
  // assertions followed by one SELECT. Support only this known guard prefix;
  // arbitrary ASSERTs, extra statements and all mutations stay rejected.
  const withoutComments = sql.replace(/--[^\n\r]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim();
  const optimizerGuards = /^ASSERT\s+EXISTS\(SELECT\s+1\s+FROM\s+prepagent\.items\s+WHERE\s+item_code\s*=\s*@item_code\)\s+AS\s+'Item not found in item master'\s*;\s*ASSERT\s+EXISTS\(SELECT\s+1\s+FROM\s+prepagent\.plants\s+WHERE\s+plant_id\s*=\s*'PLANT-01'\)\s+AS\s+'Plant settings missing'\s*;/i;
  const executableSql = scrubSql(withoutComments.replace(optimizerGuards, "")).trim();
  if (!/^(SELECT|WITH)\b/i.test(executableSql)) {
    throw new BigQueryReadError("READ_ONLY_QUERY_REQUIRED", "Only SELECT queries are allowed.");
  }
  const singleStatement = executableSql.endsWith(";")
    ? executableSql.slice(0, -1).trimEnd()
    : executableSql;
  if (singleStatement.includes(";") || MUTATING_SQL.test(singleStatement)) {
    throw new BigQueryReadError("READ_ONLY_QUERY_REQUIRED", "Only a single read-only query is allowed.");
  }
}

function parameterTypeAndValue(input) {
  const explicit = input !== null && typeof input === "object" && !Array.isArray(input)
    ? input
    : undefined;
  const value = explicit ? explicit.value : input;
  let type = explicit?.type;

  if (type === undefined) {
    if (typeof value === "string") type = "STRING";
    else if (typeof value === "boolean") type = "BOOL";
    else if (typeof value === "number") type = Number.isSafeInteger(value) ? "INT64" : "FLOAT64";
  }

  const supportedTypes = new Set(["STRING", "INT64", "FLOAT64", "BOOL", "DATE", "TIMESTAMP"]);
  if (!supportedTypes.has(type) || value === undefined || value === null) {
    throw new BigQueryReadError(
      "INVALID_QUERY_PARAMETER",
      "Query parameters must use a supported scalar type and a non-null value.",
    );
  }
  if ((type === "INT64" && !Number.isSafeInteger(value)) ||
      (type === "FLOAT64" && (typeof value !== "number" || !Number.isFinite(value))) ||
      (type === "BOOL" && typeof value !== "boolean") ||
      (["STRING", "DATE", "TIMESTAMP"].includes(type) && typeof value !== "string")) {
    throw new BigQueryReadError("INVALID_QUERY_PARAMETER", "Query parameter value does not match its type.");
  }

  return { type, value: String(value) };
}

function encodeParameters(parameters) {
  if (parameters === undefined) return [];
  if (parameters === null || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new BigQueryReadError("INVALID_QUERY_PARAMETER", "Query parameters must be a named object.");
  }

  return Object.entries(parameters).map(([name, input]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new BigQueryReadError("INVALID_QUERY_PARAMETER", "Query parameter name is invalid.");
    }
    const { type, value } = parameterTypeAndValue(input);
    return {
      name,
      parameterType: { type },
      parameterValue: { value },
    };
  });
}

export function createCloudRunAccessTokenProvider({ fetchImpl = fetch } = {}) {
  return async ({ signal } = {}) => {
    let response;
    try {
      response = await fetchImpl(CLOUD_RUN_METADATA_TOKEN_URL, {
        headers: { "Metadata-Flavor": "Google" },
        signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new BigQueryReadError(
        "CLOUD_IDENTITY_UNAVAILABLE",
        "Cloud Run workload identity is unavailable in this runtime.",
      );
    }

    if (!response.ok) {
      throw new BigQueryReadError(
        "CLOUD_IDENTITY_UNAVAILABLE",
        "Cloud Run workload identity could not provide an access token.",
      );
    }

    const payload = await response.json();
    if (typeof payload?.access_token !== "string" || payload.access_token.length === 0) {
      throw new BigQueryReadError(
        "CLOUD_IDENTITY_UNAVAILABLE",
        "Cloud Run workload identity returned an invalid token response.",
      );
    }
    return payload.access_token;
  };
}

/**
 * Create a BigQuery query transport that can execute bounded, parameterized
 * read queries. It never runs DDL or DML. The returned rows retain BigQuery's
 * schema/value representation so callers can validate them with project schemas.
 * maximumBytesBilled bounds query bytes only; it is not a project-wide spend cap
 * and does not authorize model calls, training, writes, storage, or deployment.
 */
export function createBigQueryReadClient({
  projectId,
  location = "asia-south1",
  maximumBytesBilled = DEFAULT_MAX_BYTES_BILLED,
  tokenProvider,
  fetchImpl = fetch,
  maxResults = 1000,
  queryWaitMs = DEFAULT_QUERY_WAIT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
} = {}) {
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }
  if (typeof location !== "string" || !/^[a-z0-9-]+$/.test(location)) {
    throw new TypeError("A valid BigQuery location is required.");
  }
  if (!Number.isSafeInteger(maximumBytesBilled) || maximumBytesBilled < 1) {
    throw new TypeError("maximumBytesBilled must be a positive safe integer.");
  }
  if (tokenProvider !== undefined && typeof tokenProvider !== "function") {
    throw new TypeError("Token provider must be a function.");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("Fetch provider must be a function.");
  }
  if (!Number.isSafeInteger(maxResults) || maxResults < 1 || maxResults > 1000) {
    throw new TypeError("maxResults must be an integer between 1 and 1000.");
  }
  if (!Number.isSafeInteger(queryWaitMs) || queryWaitMs < 1 || queryWaitMs > 55_000 ||
      !Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 1 || pollIntervalMs > 5_000) {
    throw new TypeError("BigQuery query wait and poll interval must be within their supported bounds.");
  }
  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });

  return Object.freeze({
    async query({ sql, parameters, signal } = {}) {
      assertReadOnlySql(sql);
      const queryParameters = encodeParameters(parameters);
      const accessToken = await provideToken({ signal });
      if (typeof accessToken !== "string" || accessToken.length === 0) {
        throw new BigQueryReadError("CLOUD_IDENTITY_UNAVAILABLE", "No cloud access token was provided.");
      }

      let response;
      try {
        response = await fetchImpl(
          `${BIGQUERY_API}/projects/${encodeURIComponent(projectId)}/queries`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: sql,
              useLegacySql: false,
              location,
              maximumBytesBilled: String(maximumBytesBilled),
              maxResults,
              ...(queryParameters.length > 0
                ? { parameterMode: "NAMED", queryParameters }
                : {}),
            }),
            signal,
          },
        );
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        throw new BigQueryReadError("BIGQUERY_UNAVAILABLE", "BigQuery could not be reached.");
      }

      let payload = await readResponse(response);
      if (!response.ok || payload?.error) {
        throw new BigQueryReadError("BIGQUERY_QUERY_FAILED", "The bounded BigQuery read query failed.");
      }
      if (payload.jobComplete !== true) {
        const jobId = payload.jobReference?.jobId;
        if (typeof jobId !== "string" || jobId.length === 0) {
          throw new BigQueryReadError("BIGQUERY_QUERY_PENDING", "BigQuery returned an unfinished query without a job reference.");
        }
        const deadline = Date.now() + queryWaitMs;
        do {
          await waitForPoll(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())), signal);
          const queryUrl = new URL(
            `${BIGQUERY_API}/projects/${encodeURIComponent(projectId)}/queries/${encodeURIComponent(jobId)}`,
          );
          queryUrl.searchParams.set("location", location);
          queryUrl.searchParams.set("maxResults", String(maxResults));
          try {
            response = await fetchImpl(queryUrl, {
              method: "GET",
              headers: { Authorization: `Bearer ${accessToken}` },
              signal,
            });
          } catch (error) {
            if (error?.name === "AbortError") throw error;
            throw new BigQueryReadError("BIGQUERY_UNAVAILABLE", "BigQuery query status could not be reached.");
          }
          payload = await readResponse(response);
          if (!response.ok || payload?.error) {
            throw new BigQueryReadError("BIGQUERY_QUERY_FAILED", "The bounded BigQuery read query failed.");
          }
        } while (payload.jobComplete !== true && Date.now() < deadline);
      }
      if (payload.jobComplete !== true) {
        throw new BigQueryReadError("BIGQUERY_QUERY_PENDING", "The BigQuery query did not finish within the request deadline.");
      }
      if (payload.pageToken) {
        throw new BigQueryReadError("BIGQUERY_RESULT_LIMIT", "The query returned more rows than this request allows.");
      }

      return Object.freeze({
        schema: payload.schema ?? { fields: [] },
        rows: payload.rows ?? [],
        totalRows: Number(payload.totalRows ?? 0),
        totalBytesProcessed: Number(payload.totalBytesProcessed ?? 0),
        jobReference: payload.jobReference,
      });
    },
  });
}

async function readResponse(response) {
  try {
    return await response.json();
  } catch {
    throw new BigQueryReadError("BIGQUERY_INVALID_RESPONSE", "BigQuery returned an invalid response.");
  }
}
