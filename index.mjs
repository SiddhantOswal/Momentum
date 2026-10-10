import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { formatMoney, SUPPORTED_CURRENCIES } from "./src/currency.js";
import {
  extractOrder,
  findSimilarRuns,
  generateJobSheet,
  getConditions,
  explainRisk,
  optimizeLevers,
  predictRisk,
} from "./src/mock-agents.js";

const app = new Hono();

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : "Unexpected server error.";

  return c.json(
    {
      ok: false,
      error: "Internal server error",
      message,
      mode: "local-development",
      isRealModelPrediction: false,
    },
    500
  );
});

app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: "Not found",
      path: c.req.path,
      mode: "local-development",
      message: "The requested endpoint was not found.",
    },
    404
  );
});

const homePage = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ustaad AI | Prep Agent</title>
    <style>
      :root {
        --bg: #0b1220;
        --panel: #111b2d;
        --panel-alt: #15233d;
        --ink: #dfe7f3;
        --muted: #9bb0d1;
        --accent: #7cc4ff;
        --accent-strong: #4bb1ff;
        --ok: #34d399;
        --warning: #fbbf24;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #09111d 0%, #0d1426 100%);
        color: var(--ink);
      }
      .page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }
      .card {
        background: rgba(17, 27, 45, 0.88);
        border: 1px solid rgba(124, 196, 255, 0.2);
        border-radius: 18px;
        padding: 22px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.23);
      }
      h1 { margin-top: 0; }
      .meta {
        display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 18px;
      }
      .badge {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(75,177,255,0.12);
        border: 1px solid rgba(124, 196, 255, 0.36);
        color: var(--accent);
        font-size: 0.82rem;
      }
      .grid {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 20px;
      }
      label {
        display: block; margin-bottom: 8px; font-size: 0.9rem; color: var(--muted);
      }
      input, select, textarea, button {
        width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(156, 170, 192, 0.35);
        background: rgba(17, 35, 58, 0.88); color: var(--ink);
      }
      textarea {
        min-height: 120px; resize: vertical;
      }
      button {
        cursor: pointer; background: linear-gradient(180deg, var(--accent) 0%, var(--accent-strong) 100%);
        color: #041224; border: none; font-weight: 700; margin-top: 10px;
      }
      .result {
        margin-top: 18px; background: rgba(14, 25, 39, 0.75); border: 1px solid rgba(101, 138, 190, 0.4);
        border-radius: 12px; padding: 16px; white-space: pre-wrap; font-family: "SFMono-Regular", Consolas, monospace; font-size: 0.84rem;
      }
      .status-ok { color: var(--ok); }
      .status-warn { color: var(--warning); }
      .small { font-size: 0.82rem; color: var(--muted); }
      @media (max-width: 760px) {
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="card">
        <h1>Ustaad AI</h1>
        <div class="meta">
          <span class="badge">Corrugated Production-Prep Agent</span>
          <span class="badge">Mode: Local development</span>
          <span class="badge">Mock services enabled</span>
        </div>
        <p class="small">The local application keeps real Google Cloud services off and treats every AI response as a mock/demo value until a production backend is wired in.</p>

        <div class="grid">
          <section>
            <h2>Sample purchase order</h2>
            <label>Order ID<input id="orderId" value="PO-2048" /></label>
            <label>Customer ID<input id="customerId" value="CUST-418" /></label>
            <label>Box style<input id="boxStyle" value="RSC" /></label>
            <label>Length (mm)<input id="lengthMm" value="520" /></label>
            <label>Width (mm)<input id="widthMm" value="360" /></label>
            <label>Height (mm)<input id="heightMm" value="260" /></label>
            <label>Ply<input id="ply" value="3" /></label>
            <label>Flute profile<input id="fluteProfile" value="B" /></label>
            <label>Quantity<input id="quantity" value="1200" /></label>
            <button id="extractBtn">Extract order</button>
          </section>
          <aside>
            <h2>System notes</h2>
            <ul class="small">
              <li><span class="status-ok">Local health:</span> /health returns ok: true</li>
              <li><span class="status-warn">Mock mode:</span> no billing, no cloud access, no real predictions</li>
              <li>Supported currencies: INR, JPY, KRW, CNY, IDR, SGD, AUD, THB, PHP, MYR, USD</li>
              <li>Supported languages: en, hi, mr, ja, ko, zh-CN, id</li>
            </ul>
            <button id="statusBtn">Load app status</button>
            <div id="result" class="result">Waiting for a request…</div>
          </aside>
        </div>
      </div>
    </div>

    <script>
      const result = document.getElementById('result');
      const setResult = (payload) => { result.textContent = JSON.stringify(payload, null, 2); };

      const formValues = () => ({
        orderId: document.getElementById('orderId').value,
        customerId: document.getElementById('customerId').value,
        boxStyle: document.getElementById('boxStyle').value,
        lengthMm: Number(document.getElementById('lengthMm').value),
        widthMm: Number(document.getElementById('widthMm').value),
        heightMm: Number(document.getElementById('heightMm').value),
        ply: Number(document.getElementById('ply').value),
        fluteProfile: document.getElementById('fluteProfile').value,
        quantity: Number(document.getElementById('quantity').value),
      });

      document.getElementById('extractBtn').addEventListener('click', async () => {
        setResult({ status: 'loading', message: 'Calling mock extraction endpoint…' });
        const response = await fetch('/api/agents/extractOrder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formValues()),
        });
        const payload = await response.json();
        setResult(payload);
      });

      document.getElementById('statusBtn').addEventListener('click', async () => {
        const response = await fetch('/api/status');
        const payload = await response.json();
        setResult(payload);
      });
    </script>
  </body>
</html>`;

app.get("/", (c) => {
  return c.html(homePage);
});

app.get("/health", (c) => {
  return c.json({ ok: true, mode: "local-development" });
});

app.get("/api/status", (c) => {
  return c.json({
    ok: true,
    app: "Ustaad AI",
    description: "Corrugated Production-Prep Agent",
    status: "running",
    mode: "local-development",
    isRealModelPrediction: false,
    mockServices: [
      "order extraction",
      "plant conditions",
      "defect risk prediction",
      "optimizer",
      "similar run lookup",
      "risk explanation",
      "job sheet generation",
    ],
    supportedCurrencies: SUPPORTED_CURRENCIES,
    supportedLanguages: ["en", "hi", "mr", "ja", "ko", "zh-CN", "id"],
    notes: [
      "This local build does not contact Google Cloud resources.",
      "Any predictions or evidence are mock/demo values marked as such.",
    ],
  });
});

app.post("/api/agents/extractOrder", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ ok: false, error: "Request body must be valid JSON.", mode: "local-development" }, 400);
  }

  const result = extractOrder(body);
  return result.ok ? c.json(result) : c.json(result, 400);
});

app.post("/api/agents/getConditions", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ ok: false, error: "Request body must be valid JSON.", mode: "local-development" }, 400);
  }

  const result = getConditions(body);
  return result.ok ? c.json(result) : c.json(result, 400);
});

app.post("/api/agents/predictRisk", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ ok: false, error: "Request body must be valid JSON.", mode: "local-development" }, 400);
  }

  const { order, conditions } = body;
  const result = predictRisk(order, conditions);
  return result.ok ? c.json(result) : c.json(result, 400);
});

app.post("/api/agents/optimizeLevers", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ ok: false, error: "Request body must be valid JSON.", mode: "local-development" }, 400);
  }

  const { order, conditions } = body;
  const result = optimizeLevers(order, conditions);
  return result.ok ? c.json(result) : c.json(result, 400);
});

app.post("/api/agents/findSimilarRuns", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ ok: false, error: "Request body must be valid JSON.", mode: "local-development" }, 400);
  }

  const result = findSimilarRuns(body);
  return result.ok ? c.json(result) : c.json(result, 400);
});

app.post("/api/agents/explainRisk", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ ok: false, error: "Request body must be valid JSON.", mode: "local-development" }, 400);
  }

  const { order, conditions, riskSummary } = body;
  const result = explainRisk(order, conditions, riskSummary);
  return result.ok ? c.json(result) : c.json(result, 400);
});

app.post("/api/agents/generateJobSheet", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ ok: false, error: "Request body must be valid JSON.", mode: "local-development" }, 400);
  }

  const { order, conditions, riskSummary } = body;
  const result = generateJobSheet(order, conditions, riskSummary);
  return result.ok ? c.json(result) : c.json(result, 400);
});

const port = Number(process.env.PORT) || 8080;

serve({
  fetch: app.fetch,
  port,
});

console.log(`Ustaad AI Prep Agent running at http://localhost:${port}`);