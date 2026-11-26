import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, PageHeader, Stepper, type StepState } from "../ui/components";
import { conditionsPath, currentShift, getJson, type Conditions } from "../lib/api";
import { send, type Extraction, type JobResult, type LeverKey, type Levers } from "../lib/session";
import { OrderStep, type OrderSource, type ReadState } from "./new-lot/OrderStep";
import { ConditionsStep } from "./new-lot/ConditionsStep";
import { PlanStep, RecoveryStep } from "./new-lot/PlanStep";
import { ReviewStep } from "./new-lot/ReviewStep";
import { IdStrip, Toasts, type Toast } from "./new-lot/parts";
import {
  EMPTY_CONDITIONS, EMPTY_CONTEXT, EMPTY_LEVERS, MAX_UPLOAD_BYTES, SAMPLES, STEPS, UPLOAD_TYPES,
  conditionPatch, fieldProgress, hasExplanation, isReplaced, lineChoice, planBody, planFingerprint, revisionLabel,
  type ConditionKey, type ConditionValues, type LineChoice, type LotRead, type OrderContext,
} from "./new-lot/model";
import "./new-lot/new-lot.css";

const SUBTITLE = [
  "Check each value against the order before you confirm.",
  "Confirm today's conditions and your planned settings.",
  "Compare the two plans, then decide.",
  "Review the job card. Approving issues it.",
];

type Check = [boolean, boolean, boolean];
const NO_CHECKS: Check = [false, false, false];

export function NewLot() {
  const [stage, setStage] = useState(0);
  const [source, setSource] = useState<OrderSource>();
  const [file, setFile] = useState<File>();
  const [readState, setReadState] = useState<ReadState>("idle");
  const [readError, setReadError] = useState<string>();
  const [extraction, setExtraction] = useState<Extraction>();
  const [lineIndex, setLineIndex] = useState<number>();
  const [choice, setChoice] = useState<LineChoice>({ code: "", quantity: "" });
  const [context, setContext] = useState<OrderContext>(EMPTY_CONTEXT);
  const [checks, setChecks] = useState<Check>(NO_CHECKS);
  const [conditions, setConditions] = useState<ConditionValues>(EMPTY_CONDITIONS);
  const [touched, setTouched] = useState<ReadonlySet<ConditionKey>>(new Set());
  const [prefilled, setPrefilled] = useState<ReadonlySet<ConditionKey>>(new Set());
  const [loadNote, setLoadNote] = useState<string>();
  const [conditionsReady, setConditionsReady] = useState(false);
  const [levers, setLevers] = useState<Levers>(EMPTY_LEVERS);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string>();
  const [result, setResult] = useState<JobResult>();
  const [lotRead, setLotRead] = useState<LotRead>();
  const [lotReadFailed, setLotReadFailed] = useState(false);
  const [held, setHeld] = useState(false);
  const [continued, setContinued] = useState(false);
  const [kept, setKept] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idempotency = useRef({ fingerprint: "", key: "" });
  const conditionsLoaded = useRef(false);
  const reads = useRef(0);

  const toast = useCallback((next: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    // Two at a time keeps them clear of the page content; a failure stays until it is dismissed.
    setToasts((all) => [...all.filter((entry) => entry.title !== next.title), { ...next, id }].slice(-2));
    if (next.tone !== "bad") setTimeout(() => setToasts((all) => all.filter((entry) => entry.id !== id)), 8000);
  }, []);
  const dismiss = (id: string) => setToasts((all) => all.filter((entry) => entry.id !== id));

  const goStage = (next: number) => { setToasts([]); setStage(next); };

  const lotId = result?.revision?.lotId;
  const progress = fieldProgress(conditions, levers);
  const noExplanation = !!result && !hasExplanation(result);
  const replaced = !!result && stage === 3 && isReplaced(lotRead, result);

  const readLot = useCallback(async (id: string) => {
    const read = await getJson<LotRead>(`/lots/${encodeURIComponent(id)}`);
    if (read.ok) { setLotRead(read.data); setLotReadFailed(false); return read.data; }
    setLotRead(undefined); setLotReadFailed(true);
    return undefined;
  }, []);

  const resetOrder = () => {
    setExtraction(undefined); setLineIndex(undefined); setChoice({ code: "", quantity: "" }); setChecks(NO_CHECKS);
    setReadError(undefined);
  };

  const readOrder = async (next: File, known: OrderContext) => {
    const ticket = ++reads.current;
    setFile(next); setReadState("reading"); resetOrder(); setContext(known);
    const body = new FormData();
    body.append("file", next);
    for (const [key, value] of Object.entries(known)) if (value) body.append(key, value);
    const response = await send<Extraction>("/orders/extract", { method: "POST", body });
    if (ticket !== reads.current) return;
    if (!response.ok) { setReadState("failed"); setReadError(response.error); return; }
    const data = response.data;
    setReadState("read"); setExtraction(data);
    setContext({ ...known, orderId: known.orderId || data.purchaseOrderDocument?.poNumber || "" });
    const usable = data.lines.filter((entry) => entry.extractedItemCode);
    const only = data.lines.length === 1 ? data.lines[0] : usable.length === 1 ? usable[0] : undefined;
    if (only) { setLineIndex(only.lineIndex); setChoice(lineChoice(only)); }
    if (data.lines.length > 1) toast({ tone: "warn", title: "Check the source line", text: `This order has ${data.lines.length} lines. Only one is prepared.` });
  };

  const pickSample = async (id: string) => {
    const sample = SAMPLES.find((entry) => entry.id === id)!;
    setSource({ kind: "sample", id }); setReadError(undefined); setReadState("reading");
    let blob: Blob;
    try {
      const response = await fetch(`/samples/${sample.file}`);
      if (!response.ok) throw new Error(String(response.status));
      blob = await response.blob();
    } catch {
      setReadState("failed"); setReadError("The sample order could not be loaded."); setFile(undefined);
      return;
    }
    await readOrder(new File([blob], sample.file, { type: sample.mime }), sample.context ?? EMPTY_CONTEXT);
  };

  const upload = (next: File) => {
    if (!UPLOAD_TYPES.includes(next.type)) { setReadState("failed"); setReadError("Use a PDF or a JPEG."); return; }
    if (next.size > MAX_UPLOAD_BYTES) { setReadState("failed"); setReadError("The file is over 10 MiB."); return; }
    setSource({ kind: "upload", name: next.name });
    void readOrder(next, EMPTY_CONTEXT);
  };

  const selectLine = (index: number) => {
    setLineIndex(index); setChecks(NO_CHECKS);
    setChoice(lineChoice(extraction?.lines.find((entry) => entry.lineIndex === index)));
  };

  const loadConditions = async () => {
    if (conditionsLoaded.current) return;
    conditionsLoaded.current = true;
    const response = await getJson<Conditions>(conditionsPath());
    if (!response.ok) { setLoadNote("Today's conditions could not be read. Enter them below."); setConditionsReady(true); return; }
    const data = response.data.data;
    const next: Partial<ConditionValues> = {
      ambientRhPct: String(data.ambientRhPct), ambientTempC: String(data.ambientTempC), paperMoisturePct: String(data.paperMoisturePct),
      runDate: data.runDate?.slice(0, 10) ?? "", shift: data.shift ?? currentShift(),
    };
    setConditions((current) => {
      const merged = { ...current };
      for (const key of Object.keys(next) as ConditionKey[]) if (current[key] === "" && next[key]) merged[key] = next[key]!;
      return merged;
    });
    setPrefilled(new Set(Object.keys(next) as ConditionKey[]));
    setLoadNote("There is no plant sensor feed. These values come from the reference record. Confirm or change them.");
    setConditionsReady(true);
  };

  const confirmOrder = () => {
    goStage(1);
    void loadConditions();
  };

  useEffect(() => {
    if (stage !== 1 || !conditionsReady) return;
    toast(progress.left === 0
      ? { tone: "ok", title: "All fields confirmed", text: "You can plan this lot." }
      : { tone: "warn", title: `${progress.left} ${progress.left === 1 ? "field" : "fields"} left to confirm`, text: "Analysis stays blocked until then." });
  }, [stage, conditionsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCondition = (key: ConditionKey, value: string) => {
    setConditions((current) => ({ ...current, [key]: value }));
    setTouched((current) => new Set(current).add(key));
  };
  const setLever = (key: LeverKey, value: string) => setLevers((current) => ({ ...current, [key]: value }));

  const plan = async () => {
    if (!file || !extraction || lineIndex === undefined) return;
    setPlanning(true); setPlanError(undefined);
    const input = { file, context, extraction, lineIndex, choice, conditions, levers, lotId };
    if (lotId) {
      const saved = await send<unknown>(`/lots/${encodeURIComponent(lotId)}/conditions`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditions: conditionPatch(conditions, touched) }),
      });
      if (!saved.ok) { setPlanning(false); setPlanError(saved.error); return; }
    }
    const fingerprint = planFingerprint(input);
    if (fingerprint !== idempotency.current.fingerprint) idempotency.current = { fingerprint, key: crypto.randomUUID() };
    const response = await send<JobResult>("/jobs", { method: "POST", body: planBody(input), headers: { "Idempotency-Key": idempotency.current.key } });
    setPlanning(false);
    if (!response.ok) { setPlanError(response.error); return; }
    const next = response.data;
    setResult({ jobSheet: next.jobSheet, revision: next.revision, runId: next.runId, confidence: next.confidence, conditionNotes: next.conditionNotes });
    setHeld(false); setContinued(false); setKept(false); setLotRead(undefined);
    if (next.revision?.lotId) void readLot(next.revision.lotId); else setLotReadFailed(true);
    goStage(2);
    toast(hasExplanation(next)
      ? { tone: "ok", title: "Recommendation ready", text: `${next.jobSheet.changes.length} ${next.jobSheet.changes.length === 1 ? "change" : "changes"} recommended.` }
      : { tone: "bad", title: "Explanation did not finish", text: "Numbers are saved. Retry or continue." });
  };

  const review = async () => {
    goStage(3);
    if (!lotId) return;
    const read = await readLot(lotId);
    if (read && result && !isReplaced(read, result)) toast({ tone: "ok", title: "Draft saved", text: `${revisionLabel(result)} is stored and read back.` });
  };

  useEffect(() => {
    if (stage !== 3 || !lotId) return;
    const refresh = () => { void readLot(lotId); };
    addEventListener("focus", refresh);
    return () => removeEventListener("focus", refresh);
  }, [stage, lotId, readLot]);

  useEffect(() => {
    if (replaced) toast({ tone: "bad", title: "Approval blocked", text: `${result ? revisionLabel(result) : "The revision"} was replaced. Plan the lot again.` });
  }, [replaced]); // eslint-disable-line react-hooks/exhaustive-deps

  const planAgain = () => { goStage(1); setKept(false); void loadConditions(); };

  const recovering = stage === 2 && noExplanation && !continued;
  const view = recovering ? 2 : stage;
  const states: StepState[] = STEPS.map((_, index) => index < stage ? "done" : index === stage ? "current" : "upcoming");
  const steps = STEPS.map((label, index) => ({ label, state: states[index] }));
  const subtitle = recovering ? "Part of the analysis did not finish. The rest is kept."
    : replaced ? "Out of date. Nothing has been approved." : SUBTITLE[stage];

  const strip = useMemo(() => {
    const approved = result?.jobSheet.status === "APPROVED";
    let status = "Order not confirmed", next = "Operator: confirm order", tone: "warn" | undefined;
    if (stage === 1) {
      status = progress.left === 0 ? "Conditions complete" : "Conditions incomplete";
      next = progress.left === 0 ? "Operator: plan this lot" : `Operator: confirm ${progress.left} ${progress.left === 1 ? "field" : "fields"}`;
      tone = progress.left === 0 ? undefined : "warn";
    } else if (recovering) { status = "Comparison saved, explanation missing"; next = "Supervisor: retry or hold"; }
    else if (stage === 2) { status = "Comparison ready"; next = "Supervisor review"; }
    else if (replaced) { status = "Out of date, approval blocked"; next = "Operator: plan this lot again"; }
    else if (stage === 3) { status = approved ? "Approved, demo session" : "Draft, not approved"; next = approved ? "Open the job card" : "Supervisor approval"; }
    return { status, next, tone };
  }, [stage, progress.left, recovering, replaced, result]);

  const lot = stage === 0 ? choice.code || "Not recorded" : result?.jobSheet.order.itemCode ?? (choice.code || "Not recorded");
  const proposal = stage >= 2 && result ? `${revisionLabel(result)}${replaced ? ", replaced" : ""}` : "Rev 1";

  return (
    <div className="nl-page">
      <PageHeader title="New lot" subtitle={subtitle} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
      <Stepper steps={steps} />
      <IdStrip tone={strip.tone} items={[
        { label: "Lot", value: lot }, { label: "Proposal", value: proposal },
        { label: "Data class", value: source?.kind === "upload" ? "Uploaded order" : "Synthetic demonstration" },
        { label: "Status", value: strip.status }, { label: "Next", value: strip.next, end: true },
      ]} />
      {view === 0 && (
        <OrderStep source={source} fileName={file?.name} readState={readState} readError={readError} extraction={extraction} lineIndex={lineIndex}
          choice={choice} context={context} checks={checks} onSample={(id) => void pickSample(id)} onUpload={upload} onLine={selectLine}
          onChoice={(next) => { setChoice(next); setChecks(NO_CHECKS); }} onContext={(next) => { setContext(next); setChecks(NO_CHECKS); }}
          onCheck={(index, value) => setChecks((current) => current.map((entry, at) => at === index ? value : entry) as Check)} onConfirm={confirmOrder} />
      )}
      {view === 1 && (
        <ConditionsStep conditions={conditions} levers={levers} touched={touched} prefilled={prefilled} loadNote={loadNote} planning={planning} planError={planError}
          onCondition={setCondition} onLever={setLever} onBack={() => goStage(0)} onPlan={() => void plan()} />
      )}
      {view === 2 && result && (recovering
        ? <RecoveryStep result={result} held={held} onRetry={() => undefined} onContinue={() => setContinued(true)} onHold={() => setHeld(true)} />
        : <PlanStep result={result} onReview={() => void review()} />)}
      {view === 3 && result && (
        <ReviewStep result={result} setResult={setResult} lotRead={lotRead} lotReadFailed={lotReadFailed} held={held} noExplanation={noExplanation}
          replaced={replaced} kept={kept} onKeepDraft={() => toast({ tone: "ok", title: "Draft kept", text: "Nothing is approved." })}
          onPlanAgain={planAgain} onKeepHistory={() => setKept(true)} />
      )}
      {stage === 2 && !result && <Alert tone="bad" title="No plan to show.">Plan the lot from the Conditions step.</Alert>}
    </div>
  );
}
