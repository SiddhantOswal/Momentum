// Runs the release-candidate configuration on a laptop against the live project (ARC-DEV-01).
// Settings come from the `momentum` Cloud Run service at start, so the local run cannot drift
// from production; every Arc and M1 flag is then turned on, with the budget store's live-pool limits. Credentials are the developer's own gcloud
// login, served on a loopback metadata endpoint that the server reads through GCE_METADATA_HOST.
// Never imported by the Cloud Run entry point.
import { execFileSync, execFile } from "node:child_process";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
if (process.env.K_SERVICE) throw new Error("run-local-live is for laptops; it refuses to run on Cloud Run.");

const PROJECT = process.env.USTAAD_LOCAL_LIVE_PROJECT ?? "prepagent-hack";
const REGION = process.env.USTAAD_LOCAL_LIVE_REGION ?? "asia-south1";
const SERVICE = process.env.USTAAD_LOCAL_LIVE_SERVICE ?? "momentum";
const PORT = process.env.USTAAD_LOCAL_LIVE_PORT ?? "4173";
if (!/^\d{4,5}$/.test(PORT) || Number(PORT) < 1024 || Number(PORT) > 65535) {
  throw new Error("USTAAD_LOCAL_LIVE_PORT must be an integer from 1024 to 65535.");
}

// Every M1 and Arc flag that exists in code (04 section 3.5). Condition provenance is not built yet.
export const RELEASE_FLAGS = Object.freeze({
  USTAAD_ENABLE_ARC: "true",
  USTAAD_ENABLE_ARC_METRICS: "true",
  USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY: "true",
  USTAAD_ENABLE_DURABLE_PO_REVIEWS: "true",
  USTAAD_ENABLE_DURABLE_TRACES: "true",
  USTAAD_ENABLE_LOT_REVISIONS: "true",
  USTAAD_ENFORCE_APPROVE_GUARD: "true",
  USTAAD_ENFORCE_MODEL_VERSIONS: "true",
  USTAAD_GEMINI_BUDGET_POLICY: "budget-v2",
  // The live pool with the design's proposed limits (04 section 5.2, F2: Rs 600 a day). The eval
  // pool needs an eval suite name on every reservation, so it cannot serve manual testing. Today's
  // production revision still counts on gemini_daily_usage, so these counters are not shared with it.
  GEMINI_BUDGET_LIMITS: JSON.stringify({
    pool: "live", dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120,
    minuteLimit: 20, sessionMinuteLimit: 6, dayCostCapInr: 600,
    demoSessionMint: { perIpPerHour: 30 },
    pitchClaim: { attemptsPerIpPerHour: 5 },
  }),
});

function gcloud(args) {
  return execFileSync("gcloud", [...args, `--project=${PROJECT}`], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

/** Plain settings and secret references of the live service, as Cloud Run passes them in. */
export function serviceEnvironment(service) {
  const container = service?.spec?.template?.spec?.containers?.[0];
  const plain = {};
  const secrets = [];
  for (const entry of container?.env ?? []) {
    if (typeof entry.value === "string") plain[entry.name] = entry.value;
    const ref = entry.valueFrom?.secretKeyRef;
    if (ref?.name) secrets.push({ name: entry.name, secret: ref.name, version: ref.key || "latest" });
  }
  return { plain, secrets };
}

/** A metadata endpoint on loopback that answers only Google metadata requests. */
export function createLocalMetadataServer({ getToken, projectId }) {
  return createServer(async (request, response) => {
    if (request.headers["metadata-flavor"] !== "Google") {
      response.writeHead(403).end();
      return;
    }
    const send = (status, body, type = "text/plain") => {
      response.writeHead(status, { "Metadata-Flavor": "Google", "Content-Type": type }).end(body);
    };
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    try {
      if (path === "/computeMetadata/v1/instance/service-accounts/default/token") {
        const token = await getToken();
        send(200, JSON.stringify({ access_token: token.value, expires_in: token.expiresIn, token_type: "Bearer" }), "application/json");
      } else if (path === "/computeMetadata/v1/project/project-id") {
        send(200, projectId);
      } else if (path === "/" || path === "/computeMetadata/v1" || path === "/computeMetadata/v1/" || path === "/computeMetadata/v1/instance") {
        send(200, "");
      } else {
        send(404, "");
      }
    } catch {
      send(503, "");
    }
  });
}

/** Caches the developer's gcloud access token; gcloud tokens last an hour, so refresh after 45 minutes. */
export function createGcloudTokenSource({ fetchToken = async () => (await run("gcloud", ["auth", "print-access-token"])).stdout.trim(), now = Date.now } = {}) {
  let cached;
  let pending;
  return async () => {
    if (cached && cached.expiresAt > now()) return { value: cached.value, expiresIn: Math.floor((cached.expiresAt - now()) / 1000) };
    pending ??= fetchToken().then((value) => {
      if (!value) throw new Error("gcloud returned no token");
      cached = { value, expiresAt: now() + 45 * 60 * 1000 };
      return cached;
    }).finally(() => { pending = undefined; });
    const token = await pending;
    return { value: token.value, expiresIn: Math.floor((token.expiresAt - now()) / 1000) };
  };
}

async function main() {
  const service = JSON.parse(gcloud(["run", "services", "describe", SERVICE, `--region=${REGION}`, "--format=json"]));
  const { plain, secrets } = serviceEnvironment(service);
  const env = { ...plain };
  for (const { name, secret, version } of secrets) {
    env[name] = gcloud(["secrets", "versions", "access", version, `--secret=${secret}`]);
  }
  const metadata = createLocalMetadataServer({ getToken: createGcloudTokenSource(), projectId: PROJECT });
  await new Promise((resolve) => metadata.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, env, RELEASE_FLAGS, {
    PORT,
    USTAAD_PUBLIC_ORIGIN: `http://localhost:${PORT}`,
    GCE_METADATA_HOST: `127.0.0.1:${metadata.address().port}`,
    GOOGLE_CLOUD_PROJECT: PROJECT,
  });
  console.log(`LOCAL LIVE: ${SERVICE} settings from Cloud Run (${Object.keys(plain).length} settings, ${secrets.length} secrets, values not shown), every Arc and M1 flag on, Gemini budget live pool (Rs 600 a day cap). Real BigQuery, Firestore, Cloud Storage and Vertex AI as your gcloud account.`);
  await import("../index.mjs");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`run-local-live: ${error.message}`);
    process.exitCode = 1;
  });
}
