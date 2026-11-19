import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileUp, Plus, Sparkles, ArrowRight, Check, FileDown, Loader2, AlertTriangle } from "lucide-react";
import { DEFECTS, formatMoney, formatNumber, getJson } from "../lib/api";
import { useLive, timeAgo, type LiveLot } from "../lib/live";
import { LEVERS, send, type Extraction, type ExtractedLine, type JobResult, type JobSheet, type LeverKey, type Levers } from "../lib/session";
import { Empty, Panel, Tag } from "../components/ui";

const tooltipStyle = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", fontSize: 12 };
const SAMPLE = { url: "/samples/PO1_ClientA_single_B1047.pdf", name: "PO1_ClientA_single_B1047.pdf", orderId: "TEST-CLA/PO/2026/1047", paperType: "RECYCLED", paperSupplier: "SUP-D" };
const STATUS_TONE: Record<string, "neutral" | "accent" | "good" | "bad"> = { planned: "accent", approved: "good", running: "good", done: "neutral", blocked: "bad" };

const inputClass = "h-11 w-full rounded-lg border border-line bg-panel-2 px-3 text-[14px] text-text outline-none transition-colors placeholder:text-faint focus:border-accent";
const Button = ({ children, tone = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost" }) => (
  <button type="button" {...props}
    className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-[13.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${tone === "primary" ? "bg-accent text-accent-ink hover:brightness-105" : "border border-line text-text hover:bg-raised"} ${props.className ?? ""}`}>
    {children}
  </button>
);
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] text-muted">{label}{hint && <span className="text-faint"> · {hint}</span>}</span>
      {children}
    </label>
  );
}
function Step({ n, title, done, children, action }: { n: number; title: string; done?: boolean; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${done ? "bg-good-soft text-good" : "bg-accent-soft text-accent"}`}>{done ? <Check size={13} /> : n}</span>
        <h3 className="text-[14px] font-medium">{title}</h3>
        <div className="ml-auto">{action}</div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
const Alert = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2.5 text-[13px] text-bad"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{children}</p>
);

function LotList({ lots, selected, onSelect, onNew }: { lots: LiveLot[]; selected?: string; onSelect: (l: LiveLot) => void; onNew: () => void }) {
  return (
    <Panel title="Lots" action={<button type="button" onClick={onNew} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-medium text-accent-ink"><Plus size={14} />New lot</button>} pad={false}>
      {lots.length === 0 ? <div className="p-4"><Empty title="No lots yet" hint="Plan your first lot from a purchase order." /></div> : (
        <ul className="flex flex-col p-2">
          {lots.map((lot) => (
            <li key={lot.lotId}>
              <button type="button" onClick={() => onSelect(lot)} aria-current={selected === lot.lotId ? "true" : undefined}
                className={`flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left transition-colors ${selected === lot.lotId ? "bg-accent-soft" : "hover:bg-raised"}`}>
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13.5px] font-medium">{lot.itemCode}</span>
                  <span className="ml-auto"><Tag tone={STATUS_TONE[lot.status]}>{lot.status}</Tag></span>
                </span>
                <span className="flex items-center gap-2 text-[12px] text-muted">
                  <span className="truncate">{lot.orderId}</span><span className="text-faint">·</span><span className="num">{formatNumber(lot.quantity)} units</span>
                </span>
                <span className="flex items-center gap-2 text-[11.5px] text-faint">
                  {lot.totalScrapPct !== undefined && <span className="num">{formatNumber(lot.totalScrapPct, 2)}% scrap{lot.primaryDefect ? ` · ${DEFECTS.find((d) => d.key === lot.primaryDefect)?.short}` : ""}</span>}
                  <span className="ml-auto">{timeAgo(lot.updatedAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const lineProblem = (line: ExtractedLine, code: string, qty: string) => {
  if (line.validationIssues?.length) return `The extracted line looks malformed (${line.validationIssues.join(", ")}). Check it against the order.`;
  if (line.candidates?.length && !line.candidates.includes(code)) return "This code matches more than one catalogue item. Pick the right one.";
  if ((line.status === "UNKNOWN_CODE" || line.catalogStatus === "UNKNOWN_CODE") && code === line.extractedItemCode) return "This code isn't in our item catalogue. Enter the correct code.";
  if (!/^\d+$/.test(qty) || Number(qty) < 1) return "Enter the quantity shown on the order.";
  return undefined;
};

function NewLot({ onPlanned }: { onPlanned: (r: JobResult, file: File) => void }) {
  const [file, setFile] = useState<File>();
  const [ctx, setCtx] = useState({ orderId: "", paperType: "", paperSupplier: "" });
  const [extraction, setExtraction] = useState<Extraction>();
  const [lineIndex, setLineIndex] = useState<number>();
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("");
  const [cond, setCond] = useState({ runDate: new Date().toISOString().slice(0, 10), shift: "DAY", ambientRhPct: "", ambientTempC: "", paperMoisturePct: "" });
  const [condSource, setCondSource] = useState<string>();
  const [levers, setLevers] = useState<Levers>(() => Object.fromEntries(LEVERS.map((l) => [l.key, ""])) as Levers);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"" | "read" | "cond" | "plan">("");
  const [error, setError] = useState<{ step: number; text: string }>();
  const idempotency = useRef<{ fp: string; key: string }>({ fp: "", key: "" });
  const fileInput = useRef<HTMLInputElement>(null);

  const line = extraction?.lines.find((l) => l.lineIndex === lineIndex);
  const problem = line ? lineProblem(line, code.trim(), qty.trim()) : "Select the order line to plan.";
  const condOk = [cond.ambientRhPct, cond.ambientTempC, cond.paperMoisturePct].every((v) => v !== "" && Number.isFinite(Number(v)));
  const leversOk = LEVERS.every((l) => levers[l.key] !== "");
  const ready = !!extraction && !problem && condOk && leversOk && confirmed;

  const chooseLine = (l: ExtractedLine) => { setLineIndex(l.lineIndex); setCode(l.extractedItemCode ?? ""); setQty(l.quantity === undefined ? "" : String(l.quantity)); setConfirmed(false); };
  const resetReview = () => { setExtraction(undefined); setLineIndex(undefined); setConfirmed(false); };

  const useSample = async () => {
    const blob = await fetch(SAMPLE.url).then((r) => (r.ok ? r.blob() : Promise.reject())).catch(() => undefined);
    if (!blob) { setError({ step: 1, text: "The sample order is unavailable." }); return; }
    setFile(new File([blob], SAMPLE.name, { type: "application/pdf" }));
    setCtx({ orderId: SAMPLE.orderId, paperType: SAMPLE.paperType, paperSupplier: SAMPLE.paperSupplier });
    resetReview(); setError(undefined);
  };
  const readOrder = async () => {
    if (!file || !ctx.orderId || !ctx.paperType || !ctx.paperSupplier) { setError({ step: 1, text: "Add the order file, order ID, paper type and supplier." }); return; }
    setBusy("read"); setError(undefined); resetReview();
    const body = new FormData();
    body.append("file", file); body.append("orderId", ctx.orderId); body.append("paperType", ctx.paperType); body.append("paperSupplier", ctx.paperSupplier);
    const r = await send<Extraction>("/orders/extract", { method: "POST", body });
    setBusy("");
    if (!r.ok) { setError({ step: 1, text: r.error }); return; }
    setExtraction(r.data);
    if (r.data.lines.length === 1) chooseLine(r.data.lines[0]);
  };
  const loadConditions = async () => {
    setBusy("cond");
    const r = await getJson<{ data: typeof cond & { ambientRhPct: number; ambientTempC: number; paperMoisturePct: number }; sensorSource?: string }>("/conditions/current");
    setBusy("");
    if (!r.ok) { setError({ step: 2, text: r.status === 401 ? "Sign in to load the plant reading, or enter the values." : r.error }); return; }
    const d = r.data.data;
    setCond((c) => ({ ...c, ambientRhPct: String(d.ambientRhPct), ambientTempC: String(d.ambientTempC), paperMoisturePct: String(d.paperMoisturePct) }));
    setCondSource(r.data.sensorSource === "simulated" ? "Plant feed" : "Last plant reading"); setConfirmed(false);
  };
  const plan = async () => {
    if (!ready || !file || !extraction || !line) return;
    setBusy("plan"); setError(undefined);
    const body = new FormData();
    body.append("file", file);
    Object.entries(ctx).forEach(([k, v]) => body.append(k, v));
    body.append("confirmedItemCode", code.trim()); body.append("confirmedQuantity", qty.trim());
    body.append("confirmedLineIndex", String(line.lineIndex + 1));
    body.append("reviewId", extraction.reviewId); body.append("reviewFingerprint", extraction.reviewFingerprint);
    body.append("confirmedSourceLine", "true");
    Object.entries(cond).forEach(([k, v]) => body.append(k, String(v)));
    body.append("conditionsConfirmed", "true");
    Object.entries(levers).forEach(([k, v]) => body.append(k, String(v)));
    const fp = JSON.stringify([file.name, file.size, ctx, code, qty, extraction.reviewFingerprint, cond, levers]);
    if (fp !== idempotency.current.fp) idempotency.current = { fp, key: crypto.randomUUID() };
    const r = await send<JobResult>("/jobs", { method: "POST", body, headers: { "Idempotency-Key": idempotency.current.key } });
    setBusy("");
    if (!r.ok) { setError({ step: 4, text: r.error }); return; }
    onPlanned(r.data, file);
  };

  return (
    <div className="flex flex-col gap-4">
      <Step n={1} title="Purchase order" done={!!extraction && !problem} action={<Button tone="ghost" onClick={useSample} className="h-9"><Sparkles size={15} />Try a sample order</Button>}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <button type="button" onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setFile(f); resetReview(); } }}
            className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-panel-2 px-4 text-center hover:border-accent">
            <FileUp size={20} className="text-accent" aria-hidden="true" />
            <span className="text-[13.5px]">{file ? file.name : "Drop the order PDF or photo"}</span>
            <span className="text-[12px] text-faint">{file ? `${formatNumber(file.size / 1024, 0)} KB · click to change` : "PDF or JPEG, up to 10 MB"}</span>
          </button>
          <input ref={fileInput} type="file" accept="application/pdf,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); resetReview(); } }} />
          <div className="grid content-start gap-3 sm:grid-cols-3">
            <Field label="Order ID"><input className={inputClass} value={ctx.orderId} onChange={(e) => { setCtx({ ...ctx, orderId: e.target.value }); resetReview(); }} placeholder="As on the order" /></Field>
            <Field label="Paper type">
              <select className={inputClass} value={ctx.paperType} onChange={(e) => { setCtx({ ...ctx, paperType: e.target.value }); resetReview(); }}>
                <option value="" disabled>Select</option>{["VIRGIN", "RECYCLED", "MIXED"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Paper supplier"><input className={inputClass} value={ctx.paperSupplier} onChange={(e) => { setCtx({ ...ctx, paperSupplier: e.target.value }); resetReview(); }} placeholder="Supplier code" /></Field>
            <div className="sm:col-span-3"><Button onClick={readOrder} disabled={busy === "read"}>{busy === "read" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Read order with Gemini</Button></div>
          </div>
        </div>
        {error?.step === 1 && <Alert>{error.text}</Alert>}
        {extraction && (
          <div className="mt-5 flex flex-col gap-3">
            {extraction.lines.map((l) => {
              const selected = l.lineIndex === lineIndex;
              const bad = l.status !== "MATCHED";
              return (
                <div key={l.lineIndex} className={`rounded-xl border p-4 ${selected ? "border-accent bg-accent-soft" : "border-line"}`}>
                  <label className="flex items-center gap-3">
                    <input type="radio" name="po-line" checked={selected} onChange={() => chooseLine(l)} className="h-4 w-4 accent-[var(--accent)]" />
                    <span className="text-[13.5px] font-medium">Line {l.lineIndex + 1}</span>
                    <span className="text-[12.5px] text-muted">{l.extractedItemCode ?? "No code"} · {l.quantity ?? "no quantity"}</span>
                    <span className="ml-auto"><Tag tone={bad ? "bad" : "good"}>{bad ? l.status.replaceAll("_", " ").toLowerCase() : "matched in catalogue"}</Tag></span>
                  </label>
                  {selected && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {l.candidates?.length ? (
                        <Field label="Item code" hint="pick from the catalogue">
                          <select className={inputClass} value={l.candidates.includes(code) ? code : ""} onChange={(e) => { setCode(e.target.value); setConfirmed(false); }}>
                            <option value="" disabled>Select the right item</option>{l.candidates.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </Field>
                      ) : (
                        <Field label="Item code"><input className={inputClass} value={code} onChange={(e) => { setCode(e.target.value); setConfirmed(false); }} /></Field>
                      )}
                      <Field label="Quantity"><input className={inputClass} inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value); setConfirmed(false); }} /></Field>
                      {problem && <p className="text-[12.5px] text-warn sm:col-span-2">{problem}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Step>

      <Step n={2} title="Conditions" done={condOk} action={<Button tone="ghost" className="h-9" onClick={loadConditions} disabled={busy === "cond"}>{busy === "cond" ? <Loader2 size={15} className="animate-spin" /> : null}Use plant reading</Button>}>
        <div className="grid gap-3 sm:grid-cols-5">
          <Field label="Run date"><input type="date" className={inputClass} value={cond.runDate} onChange={(e) => setCond({ ...cond, runDate: e.target.value })} /></Field>
          <Field label="Shift"><select className={inputClass} value={cond.shift} onChange={(e) => setCond({ ...cond, shift: e.target.value })}><option>DAY</option><option>NIGHT</option></select></Field>
          <Field label="Humidity" hint="%"><input className={inputClass} inputMode="decimal" value={cond.ambientRhPct} onChange={(e) => { setCond({ ...cond, ambientRhPct: e.target.value }); setCondSource(undefined); setConfirmed(false); }} placeholder="e.g. 65" /></Field>
          <Field label="Temperature" hint="°C"><input className={inputClass} inputMode="decimal" value={cond.ambientTempC} onChange={(e) => { setCond({ ...cond, ambientTempC: e.target.value }); setCondSource(undefined); setConfirmed(false); }} placeholder="e.g. 26" /></Field>
          <Field label="Paper moisture" hint="%"><input className={inputClass} inputMode="decimal" value={cond.paperMoisturePct} onChange={(e) => { setCond({ ...cond, paperMoisturePct: e.target.value }); setCondSource(undefined); setConfirmed(false); }} placeholder="e.g. 8.5" /></Field>
        </div>
        <p className="mt-3 text-[12px] text-faint">{condSource ? `From ${condSource.toLowerCase()}. ` : ""}If humidity is missing, Momentum uses live Pune weather, then the month's typical value, and says so.</p>
        {error?.step === 2 && <Alert>{error.text}</Alert>}
      </Step>

      <Step n={3} title="Your planned settings" done={leversOk}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LEVERS.map((l) => (
            <Field key={l.key} label={l.label} hint={"unit" in l ? l.unit : undefined}>
              {"options" in l ? (
                <select className={inputClass} value={String(levers[l.key])} onChange={(e) => { setLevers({ ...levers, [l.key]: e.target.value }); setConfirmed(false); }}>
                  <option value="" disabled>Select</option>{l.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input className={inputClass} inputMode="decimal" value={String(levers[l.key])} placeholder={`${l.min}–${l.max}`}
                  onChange={(e) => { setLevers({ ...levers, [l.key as LeverKey]: e.target.value }); setConfirmed(false); }} />
              )}
            </Field>
          ))}
        </div>
      </Step>

      <div className="panel flex flex-wrap items-center gap-4 px-5 py-4">
        <label className="flex items-center gap-3 text-[13.5px]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={confirmed} disabled={!extraction || !!problem || !condOk || !leversOk} onChange={(e) => setConfirmed(e.target.checked)} />
          I checked the order line, conditions and settings
        </label>
        <Button className="ml-auto" onClick={plan} disabled={!ready || busy === "plan"}>
          {busy === "plan" ? <Loader2 size={16} className="animate-spin" /> : null}{busy === "plan" ? "Agent is planning…" : "Plan this lot"}{busy !== "plan" && <ArrowRight size={16} />}
        </Button>
        {error?.step === 4 && <div className="w-full"><Alert>{error.text}</Alert></div>}
      </div>
    </div>
  );
}

function JobView({ result, onApproved }: { result: JobResult; onApproved: (sheet: JobSheet) => void }) {
  const sheet = result.jobSheet;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [asking, setAsking] = useState(false);
  const base = sheet.baseline.risk, best = sheet.recommended.risk;
  const chart = DEFECTS.map((d) => ({ name: d.short, "Your plan": base.ratesPct[d.key], Recommended: best.ratesPct[d.key] }));
  const approve = async () => {
    setBusy(true); setError(undefined);
    const r = await send<{ jobSheet: JobSheet }>(`/jobs/${encodeURIComponent(sheet.jobId)}/approve?lang=en&currency=INR`, { method: "POST" });
    setBusy(false); setAsking(false);
    if (!r.ok) { setError(r.error); return; }
    onApproved(r.data.jobSheet);
  };
  const approved = sheet.status === "APPROVED";
  const leverLabel = (k: string) => LEVERS.find((l) => l.key === k)?.label ?? k;
  const unit = (k: string) => { const l = LEVERS.find((x) => x.key === k); return l && "unit" in l ? ` ${l.unit}` : ""; };
  return (
    <div className="flex flex-col gap-4">
      <div className="panel flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-5">
        <div>
          <p className="text-[12px] text-muted">{sheet.order.orderId} · {formatNumber(sheet.order.quantity)} units</p>
          <h2 className="mt-1 text-[20px] font-semibold">{sheet.order.itemCode}</h2>
        </div>
        <Metric label="Scrap, your plan" value={`${formatNumber(base.totalScrapPct ?? 0, 2)}%`} />
        <Metric label="Scrap, recommended" value={`${formatNumber(best.totalScrapPct ?? 0, 2)}%`} accent />
        <Metric label="Predicted saving" value={formatMoney(Math.max(0, sheet.savings.inr), best.currency)} sub={`${formatNumber(Math.max(0, sheet.savings.kg), 1)} kg less scrap`} />
        <div className="ml-auto flex flex-col items-end gap-2">
          <Tag tone={approved ? "good" : "accent"}>{approved ? "Approved" : "Draft · needs approval"}</Tag>
          {result.confidence === "reduced" && <Tag tone="bad">Reduced confidence</Tag>}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel title="Predicted scrap by defect">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--faint)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "var(--faint)", fontSize: 11 }} tickLine={false} axisLine={false} unit="%" width={44} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--raised)" }} formatter={(v) => `${formatNumber(Number(v), 2)}%`} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} iconType="circle" iconSize={8} />
              <Bar dataKey="Your plan" fill="var(--line-strong)" radius={[5, 5, 0, 0]} maxBarSize={26} />
              <Bar dataKey="Recommended" fill="var(--accent)" radius={[5, 5, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
          {result.conditionNotes?.length ? <p className="mt-2 text-[12px] text-faint">{result.conditionNotes.join(" ")}</p> : null}
        </Panel>
        <Panel title={`Recommended changes · ${sheet.changes.length}`}>
          {sheet.changes.length === 0 ? <Empty title="Your plan is already the best found" /> : (
            <ul className="flex flex-col gap-2.5">
              {sheet.changes.map((c) => (
                <li key={c.lever} className="rounded-xl bg-panel-2 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[13.5px] font-medium">{leverLabel(c.lever)}</span>
                    <span className="num ml-auto text-[13px] text-muted">{c.from}{unit(c.lever)}</span>
                    <ArrowRight size={14} className="text-faint" />
                    <span className="num text-[14px] font-semibold text-accent">{c.to}{unit(c.lever)}</span>
                  </div>
                  {c.reason && <p className="mt-1 text-[12px] text-faint">{c.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {sheet.explanation && (
        <Panel title="Why these settings · Gemini">
          <p className="max-w-[80ch] text-[14px] leading-relaxed text-text/90">{sheet.explanation}</p>
        </Panel>
      )}

      <div className="panel flex flex-wrap items-center gap-4 px-5 py-4">
        <p className="text-[13px] text-muted">{approved ? "Approved. The job card is ready for the floor." : "Nothing reaches the machines until a supervisor approves."}</p>
        <div className="ml-auto flex gap-3">
          {approved ? (
            <a href={`/jobs/${encodeURIComponent(sheet.jobId)}/card.pdf`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-[13.5px] font-medium text-accent-ink"><FileDown size={16} />Job card (PDF)</a>
          ) : asking ? (
            <>
              <Button tone="ghost" onClick={() => setAsking(false)}>Keep as draft</Button>
              <Button onClick={approve} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}Confirm approval</Button>
            </>
          ) : <Button onClick={() => setAsking(true)}>Approve job card</Button>}
        </div>
        {error && <div className="w-full"><Alert>{error}</Alert></div>}
      </div>
    </div>
  );
}
const Metric = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) => (
  <div>
    <p className="text-[12px] text-muted">{label}</p>
    <p className={`num mt-1 text-[22px] font-semibold ${accent ? "text-accent" : ""}`}>{value}</p>
    {sub && <p className="text-[11.5px] text-faint">{sub}</p>}
  </div>
);

export function Lots() {
  const live = useLive();
  const [selected, setSelected] = useState<string>();
  const [result, setResult] = useState<JobResult>();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const lots = useMemo(() => live.view.lots, [live.view.lots]);

  useEffect(() => {
    if (!selected || result?.jobSheet.jobId === selected) return;
    let cancelled = false;
    setLoading(true); setLoadError(undefined);
    send<{ jobSheet: JobSheet }>(`/jobs/${encodeURIComponent(selected)}`, { method: "GET" }).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setResult({ jobSheet: r.data.jobSheet }); else setLoadError(r.error);
    });
    return () => { cancelled = true; };
  }, [selected, result]);

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <LotList lots={lots} selected={selected} onSelect={(l) => { setResult(undefined); setSelected(l.jobId ?? l.lotId); }} onNew={() => { setSelected(undefined); setResult(undefined); }} />
      </aside>
      <div className="min-w-0">
        {result ? (
          <JobView result={result} onApproved={(sheet) => setResult({ ...result, jobSheet: sheet })} />
        ) : selected ? (
          loading ? <div className="panel flex h-60 items-center justify-center text-muted"><Loader2 className="animate-spin" /></div> : <div className="panel p-6"><Empty title="This lot can't be opened" hint={loadError} /></div>
        ) : (
          <NewLot onPlanned={(r) => { setResult(r); setSelected(r.jobSheet.jobId); }} />
        )}
      </div>
    </div>
  );
}
