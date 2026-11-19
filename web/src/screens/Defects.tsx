import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, ScanSearch, AlertTriangle, ArrowRight } from "lucide-react";
import { DEFECTS, conditionsPath, formatMoney, formatNumber, getJson, type Conditions, type Defect } from "../lib/api";
import { send, LEVERS } from "../lib/session";
import { useLive } from "../lib/live";
import { Empty, Panel, Tag } from "../components/ui";

type Runs = { lots: number; avgRatePct: number; sfSpeedMpm: number; rollTempC: number; gumApplication: string; gumViscositySec: number; pastingPressure: string; dryingHours: number; printSpeedSpm: number } | null;
type Diagnosis = {
  recognised: boolean; message?: string; note?: string; source?: string;
  diagnosis?: { label: Defect | "NONE"; severity: "LOW" | "MEDIUM" | "HIGH"; confidence: number; visibleSigns: string[] };
  ambientRhPct?: number;
  pastCases?: { caseCount: number; avgRateWhenMain: number; costWhenMain: number; goodRuns: Runs; badRuns: Runs; notes: string[] };
};
const inputClass = "h-11 w-full rounded-lg border border-line bg-panel-2 px-3 text-[14px] text-text outline-none placeholder:text-faint focus:border-accent";
const SEVERITY_TONE = { LOW: "neutral", MEDIUM: "accent", HIGH: "bad" } as const;
// What to look at first on the line for each defect (plant knowledge, shown beside the history).
const WHERE: Record<Defect, string> = { WARP: "Single facer and drying", DELAM: "Gum and pasting", STRENGTH: "Single facer and board grade", PRINT: "Printing unit", CRACK: "Creasing and paper moisture" };

export function Defects() {
  const live = useLive();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [rh, setRh] = useState("");
  const [lotId, setLotId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<Diagnosis>();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getJson<Conditions>(conditionsPath()).then((r) => { if (r.ok) setRh((v) => v || String(r.data.data.ambientRhPct)); });
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f?: File) => {
    if (!f) return;
    setFile(f); setResult(undefined); setError(undefined);
    setPreview(URL.createObjectURL(f));
  };
  const diagnose = async () => {
    if (!file) return;
    setBusy(true); setError(undefined); setResult(undefined);
    const body = new FormData();
    body.append("file", file);
    if (rh.trim()) body.append("ambientRhPct", rh.trim());
    if (lotId) body.append("lotId", lotId);
    const r = await send<Diagnosis>("/evidence/diagnose-photo", { method: "POST", body });
    setBusy(false);
    if (!r.ok) setError(r.error); else setResult(r.data);
  };
  const d = result?.diagnosis;
  const defect = d && d.label !== "NONE" ? DEFECTS.find((x) => x.key === d.label) : undefined;
  // Only the live history shape is shown; anything else counts as no history.
  const past = typeof result?.pastCases?.caseCount === "number" ? result.pastCases : undefined;

  return (
    <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
      <Panel title="Diagnose a defect">
        <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
          className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-line-strong bg-panel-2 text-center hover:border-accent">
          {preview ? <img src={preview} alt="Selected sheet" className="absolute inset-0 h-full w-full object-cover" /> : (
            <>
              <Camera size={22} className="text-accent" aria-hidden="true" />
              <span className="text-[13.5px]">Take or drop a photo of the sheet</span>
              <span className="text-[12px] text-faint">JPEG, PNG or WebP, up to 8 MB</span>
            </>
          )}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5"><span className="text-[12.5px] text-muted">Humidity now · %</span>
            <input className={inputClass} inputMode="decimal" value={rh} onChange={(e) => setRh(e.target.value)} placeholder="e.g. 65" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12.5px] text-muted">Lot · optional</span>
            <select className={inputClass} value={lotId} onChange={(e) => setLotId(e.target.value)}>
              <option value="">Not linked</option>
              {live.view.lots.map((l) => <option key={l.lotId} value={l.lotId}>{l.itemCode} · {l.orderId}</option>)}
            </select></label>
        </div>
        <button type="button" onClick={diagnose} disabled={!file || busy}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[13.5px] font-medium text-accent-ink disabled:opacity-45">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}{busy ? "Gemini is looking…" : "Diagnose with Gemini"}
        </button>
        {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2.5 text-[13px] text-bad"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{error}</p>}
        <p className="mt-3 text-[12px] leading-relaxed text-faint">Gemini only reads what is visible. Causes and fixes below come from our own lot history.</p>
      </Panel>

      <div className="flex min-w-0 flex-col gap-5">
        {!result ? (
          <Panel><Empty title="No photo diagnosed yet" hint="Upload a photo of a defective sheet to see what it is and what fixed it before." /></Panel>
        ) : !result.recognised ? (
          <Panel><Empty title="Not recognised as corrugated board" hint={result.message} /></Panel>
        ) : (
          <>
            <div className="panel flex flex-wrap items-center gap-x-10 gap-y-4 px-6 py-5">
              <div>
                <p className="text-[12px] text-muted">Diagnosis{result.source === "mock-demo" ? " · local mock" : " · Gemini"}</p>
                <h2 className="mt-1 text-[24px] font-semibold">{defect ? defect.label : "No visible defect"}</h2>
              </div>
              {d && <div><p className="text-[12px] text-muted">Severity</p><div className="mt-1.5"><Tag tone={SEVERITY_TONE[d.severity]}>{d.severity.toLowerCase()}</Tag></div></div>}
              {d && (
                <div className="min-w-40">
                  <p className="text-[12px] text-muted">Confidence</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(d.confidence * 100)}%` }} /></div>
                    <span className="num text-[13px]">{Math.round(d.confidence * 100)}%</span>
                  </div>
                </div>
              )}
              {defect && <div><p className="text-[12px] text-muted">Check first</p><p className="mt-1 text-[14px] font-medium">{WHERE[defect.key]}</p></div>}
            </div>
            {d?.visibleSigns.length ? (
              <Panel title="What Gemini can see">
                <ul className="flex flex-col gap-2">{d.visibleSigns.map((s) => <li key={s} className="flex gap-2 text-[13.5px]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{s}</li>)}</ul>
              </Panel>
            ) : null}
            {defect && (past ? <History past={past} rh={result.ambientRhPct} defect={defect.label} /> : (
              <Panel title="Seen before"><Empty title="Add the humidity to compare with past lots" hint="Momentum matches lots within ±10 points of humidity." /></Panel>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function History({ past, rh, defect }: { past: NonNullable<Diagnosis["pastCases"]>; rh?: number; defect: string }) {
  const { goodRuns: good, badRuns: bad } = past;
  const rows = good && bad ? LEVERS.map((l) => {
    const g = good[l.key as keyof NonNullable<Runs>], b = bad[l.key as keyof NonNullable<Runs>];
    const differs = typeof g === "number" && typeof b === "number" ? Math.abs(g - b) / Math.max(Math.abs(b), 1) > 0.03 : g !== b;
    return { key: l.key, label: l.label, unit: "unit" in l ? l.unit : "", good: g, bad: b, differs };
  }) : [];
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="panel px-5 py-4"><p className="text-[12.5px] text-muted">{DEFECTS.find((x) => x.key === defect)?.label} lots at {rh !== undefined ? `${formatNumber(rh)}% ±10` : "this"} humidity</p><p className="num mt-2 text-[28px] font-semibold">{formatNumber(past.caseCount)}</p></div>
        <div className="panel px-5 py-4"><p className="text-[12.5px] text-muted">Typical scrap when it happens</p><p className="num mt-2 text-[28px] font-semibold">{formatNumber(past.avgRateWhenMain, 2)}<span className="text-[14px] text-muted"> %</span></p></div>
        <div className="panel px-5 py-4"><p className="text-[12.5px] text-muted">What it cost us</p><p className="num mt-2 text-[28px] font-semibold">{formatMoney(past.costWhenMain)}</p></div>
      </div>
      {rows.length > 0 && (
        <Panel title="What the good runs did differently">
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-[13px]">
              <thead className="bg-panel-2 text-left text-[11.5px] uppercase tracking-wide text-faint">
                <tr><th className="px-4 py-2.5 font-medium">Setting</th><th className="px-4 py-2.5 text-right font-medium">Worst 25% of lots</th><th className="px-4 py-2.5" /><th className="px-4 py-2.5 text-right font-medium">Best 25% of lots</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-line">
                    <td className="px-4 py-2.5">{r.label}</td>
                    <td className="num px-4 py-2.5 text-right text-muted">{String(r.bad)}{r.unit && ` ${r.unit}`}</td>
                    <td className="w-6 text-center text-faint">{r.differs ? <ArrowRight size={13} /> : null}</td>
                    <td className={`num px-4 py-2.5 text-right ${r.differs ? "font-semibold text-accent" : "text-muted"}`}>{String(r.good)}{r.unit && ` ${r.unit}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-faint">Averages of past lots, {good?.lots} best and {bad?.lots} worst. A pattern in our history, not proof of cause; plan the lot to get a model recommendation.</p>
        </Panel>
      )}
      {(past.notes ?? []).length > 0 && (
        <Panel title="Operator notes from those lots">
          <ul className="flex flex-col gap-2">{past.notes.map((n) => <li key={n} className="rounded-lg bg-panel-2 px-3.5 py-2.5 text-[13px]">“{n}”</li>)}</ul>
        </Panel>
      )}
    </>
  );
}
