import { useId, useRef, useState } from "react";
import { Button, Card, Icon, NotConnected } from "../../components/m";
import { renewSession, type Defect, type Result } from "../../lib/api";
import type { LiveLot } from "../../lib/live";
import { useResource } from "../../lib/useApp";
import { DEFECT_NAME, DEFECT_ORDER, advisoryDefects, type JobResponse } from "../home/data";

export type ExplanationRow = { defect: Defect; predictedPct: number; typicalPct: number; driverRank: number; driver: string; attributionPts: number };
type ExplanationResponse = { rows: ExplanationRow[] };

// Plain names for the model features, from the driver aliases in risk-evidence-service.js.
const DRIVER_NAME: Record<string, string> = {
  ambient_rh_pct: "Humidity", ambient_temp_c: "Ambient temperature", paper_moisture_pct: "Paper moisture",
  gum_application: "Gum application", gum_viscosity_sec: "Gum viscosity", pasting_pressure: "Pasting pressure",
  drying_hours: "Drying time", roll_temp_c: "Roll temperature", sf_speed_mpm: "Single facer speed",
  print_speed_spm: "Print speed", ink_colors: "Ink colours", ink_coverage_pct: "Ink coverage",
  flute_profile: "Flute profile", paper_type: "Paper type", paper_supplier: "Paper supplier", box_style: "Box style",
  height_mm: "Height", width_mm: "Width", length_mm: "Length", top_liner_gsm: "Top liner", flute_gsm: "Flute paper",
  inner_liner_gsm: "Inner liner", liner_bf: "Liner bursting factor", ply: "Ply", quantity: "Quantity", shift: "Shift",
  sheet_area_m2: "Sheet area", box_weight_kg: "Box weight", rh_band: "Humidity band",
  rh_x_paper_moisture: "Humidity and paper moisture", dew_point_c: "Dew point", recycled_paper_flag: "Recycled paper",
  board_gsm_per_m2: "Board weight", gum_visc_x_roll_temp: "Gum viscosity and roll temperature",
};

const ORDER_FIELDS = ["orderId", "itemCode", "customerId", "boxStyle", "lengthMm", "widthMm", "heightMm", "ply", "fluteProfile",
  "topLinerGsm", "fluteGsm", "innerLinerGsm", "linerBf", "paperType", "paperSupplier", "inkColors", "inkCoveragePct", "quantity"];
const CONDITION_FIELDS = ["runDate", "shift", "ambientRhPct", "ambientTempC", "paperMoisturePct"];
const pick = (record: Record<string, unknown>, fields: string[]) => Object.fromEntries(fields.filter((f) => record[f] !== undefined).map((f) => [f, record[f]]));

/** The /risk/explanation request rebuilt from a stored job, field for field: the stored plan
 * is the prediction and optimizer result, so nothing is recomputed here. The optimizer's
 * savings field is in rupees, so a record saved in another currency is not sent. */
export function explanationRequest(sheet: JobResponse["jobSheet"]) {
  if (sheet.savings.currency !== "INR") return undefined;
  return {
    order: pick(sheet.order, ORDER_FIELDS),
    conditions: pick(sheet.conditions, CONDITION_FIELDS),
    prediction: sheet.baseline.risk,
    optimization: {
      baseline: sheet.baseline, best: sheet.recommended,
      changes: sheet.changes, savings: { kg: sheet.savings.kg, inr: sheet.savings.amount },
    },
    evidence: sheet.evidence.slice(0, 5),
  };
}

async function postExplanation(body: unknown, retried = false): Promise<Result<ExplanationResponse>> {
  try {
    const response = await fetch("/risk/explanation", {
      method: "POST", credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (response.status === 401 && !retried) {
      await renewSession();
      return postExplanation(body, true);
    }
    const data = await response.json().catch(() => undefined);
    if (!response.ok || data?.ok === false || !Array.isArray(data?.rows)) {
      return { ok: false, status: response.status, error: data?.error?.message ?? `Request failed (${response.status})` };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Can't reach Momentum. Check the connection and try again." };
  }
}

/** Signed value exactly as returned, with a true minus sign. */
const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}`;

function Rows({ rows, advisory }: { rows: ExplanationRow[]; advisory: Set<Defect> }) {
  const defects = DEFECT_ORDER.filter((defect) => rows.some((row) => row.defect === defect));
  const [chosen, setChosen] = useState<Defect>(defects[0]);
  const defect = defects.includes(chosen) ? chosen : defects[0];
  const shown = rows.filter((row) => row.defect === defect).sort((a, b) => a.driverRank - b.driverRank);
  const largest = Math.max(...shown.map((row) => Math.abs(row.attributionPts)), Number.EPSILON);
  return (
    <>
      <div className="in-chips" role="group" aria-label="Defect" style={{ marginBottom: 10 }}>
        {defects.map((key) => (
          <button key={key} type="button" className="in-chip" aria-pressed={key === defect} onClick={() => setChosen(key)}>{DEFECT_NAME[key]}</button>
        ))}
      </div>
      <h3 className="sr-only">What moved the {DEFECT_NAME[defect]} estimate</h3>
      {advisory.has(defect) && (
        <div className="sx bd" style={{ fontSize: 14, margin: "0 0 8px" }} data-testid="attribution-confidence">
          <Icon name="bad" />Low confidence. Supervised use only.
        </div>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label={`Attribution for ${DEFECT_NAME[defect]}, percentage points`}>
        {shown.map((row) => {
          const share = (Math.abs(row.attributionPts) / largest) * 45;
          const raises = row.attributionPts > 0;
          return (
            <li key={row.driverRank} className="in-attr">
              <span>{DRIVER_NAME[row.driver] ?? row.driver}</span>
              <div className="in-axis" aria-hidden="true">
                <i />
                <b style={{ left: raises ? "50%" : `${50 - share}%`, width: `${share}%`, background: raises ? "var(--ac)" : "var(--ok)" }} />
              </div>
              <span className="n" data-testid="attribution-value">{signed(row.attributionPts)}</span>
              <span className="lb" style={{ fontSize: 13 }}>pts</span>
            </li>
          );
        })}
      </ul>
      <div className="lb" style={{ marginTop: 10, fontSize: 13.5 }}>Orange raises {DEFECT_NAME[defect]} risk. Green lowers it.</div>
    </>
  );
}

/** "What moved the estimate" for a stored lot (ARC-M6-16). Each request spends one Gemini call
 * on the server, so it runs only when the user asks for it. */
export function Attribution({ lots }: { lots: LiveLot[] }) {
  const planned = lots.filter((lot) => lot.jobId);
  const [picked, setPicked] = useState<string>();
  const jobId = picked ?? planned[0]?.jobId;
  const job = useResource<JobResponse>(jobId ? `/jobs/${encodeURIComponent(jobId)}` : null);
  const [explained, setExplained] = useState<{ jobId: string; busy: boolean; result?: Result<ExplanationResponse> }>();
  const selectId = useId();
  const inFlight = useRef(false);

  if (planned.length === 0) {
    return <NotConnected span={8} title="What moved the estimate" missing="No stored lot to explain yet. Plan a lot from a sample order first." />;
  }
  const sheet = job.result?.ok ? job.result.data.jobSheet : undefined;
  const request = sheet && explanationRequest(sheet);
  const current = explained?.jobId === jobId ? explained : undefined;

  // A disabled button still lets clicks through until React re-renders, so the ref is the guard
  // that keeps one press to one request (and one Gemini call).
  async function explain() {
    if (!request || !jobId || inFlight.current) return;
    inFlight.current = true;
    setExplained({ jobId, busy: true });
    try {
      const result = await postExplanation(request);
      setExplained((state) => (state?.jobId === jobId ? { jobId, busy: false, result } : state));
    } finally {
      inFlight.current = false;
    }
  }

  let body;
  if (job.loading) body = <p className="lb" style={{ margin: 0 }}>Reading the lot record…</p>;
  else if (!sheet) body = <p className="lb" style={{ margin: 0 }}>This lot was planned in another demo session, so its inputs cannot be read here.</p>;
  else if (!request) body = <p className="lb" style={{ margin: 0 }}>This lot's record cannot be explained in its stored currency.</p>;
  else if (current?.result?.ok) body = <Rows rows={current.result.data.rows} advisory={advisoryDefects(sheet)} />;
  else {
    body = (
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Button variant="secondary" small onClick={explain} disabled={current?.busy}>
          {current?.busy ? "Reading attribution…" : "Show what moved the estimate"}
        </Button>
        {current?.result && !current.result.ok && <span className="lb" role="alert">{current.result.error}</span>}
      </div>
    );
  }

  return (
    <Card title="What moved the estimate" meta="Selected lot, percentage points" span={8}>
      <div className="in-pick">
        <label htmlFor={selectId} className="lb">Lot</label>
        <select id={selectId} value={jobId} onChange={(event) => setPicked(event.target.value)}>
          {planned.map((lot) => <option key={lot.jobId} value={lot.jobId}>{lot.itemCode}, {lot.orderId}, {new Date(lot.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</option>)}
        </select>
      </div>
      {body}
    </Card>
  );
}
