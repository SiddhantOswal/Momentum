import { useRef, useState, type ReactNode } from "react";
import { Button, Card, Chip, ProvenanceChip } from "../components/m";
import { formatNumber } from "../lib/api";
import type { ExtractedLine, Extraction } from "./newlot/api";
import { changeContext, chooseLine, chooseSample, chooseUpload, editOrderValue, lineCode, readOrder } from "./newlot/actions";
import { FieldInput, FieldSelect, IdsBar, NewLotPage, StatusIcon, Toasts, useToasts } from "./newlot/parts";
import { SAMPLES, updateLot, useLot, type LotState } from "./newlot/store";

const PAPER_TYPES = [
  { value: "VIRGIN", label: "Virgin" }, { value: "RECYCLED", label: "Recycled" }, { value: "MIXED", label: "Mixed" },
];
const SUPPLIERS = ["SUP-A", "SUP-B", "SUP-C", "SUP-D", "SUP-E"].map((value) => ({ value, label: value }));
const CHECKS = ["The source line is the one you want", "The quantity matches the order", "The catalog item is the right box"] as const;

const LINE_STATUS: Record<ExtractedLine["status"], string> = {
  MATCHED: "Matched", AMBIGUOUS: "Pick an item", UNKNOWN_CODE: "Not in catalog",
  MISSING_ITEM_CODE: "No item code", MISSING_QTY: "No quantity", MALFORMED: "Check this line",
};

const titleCase = (word: string) => word.charAt(0) + word.slice(1).toLowerCase();

function selectedLine(lot: LotState) {
  return lot.extraction?.lines.find((line) => line.lineIndex === lot.lineIndex);
}

/** Why the order cannot be confirmed yet, in plain words, or undefined when it can. */
function orderProblem(lot: LotState): string | undefined {
  const line = selectedLine(lot);
  if (!line) return "Pick the line to prepare.";
  const code = lot.itemCode.trim();
  if (!code) return "Enter the item code from the order.";
  if (line.candidates.length > 0 && !line.candidates.includes(code)) return "This code matches more than one catalog item. Pick one.";
  if (!/^\d+$/.test(lot.quantity.trim()) || Number(lot.quantity) < 1) return "Enter the quantity on the order.";
  return undefined;
}

function PurchaseOrderCard({ lot, onToast }: { lot: LotState; onToast: ReturnType<typeof useToasts>["show"] }) {
  const [busy, setBusy] = useState<"" | "sample" | "read">("");
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const contextReady = Object.values(lot.context).every((value) => value.trim() !== "");

  const pickSample = async (id: (typeof SAMPLES)[number]["id"]) => {
    setBusy("sample"); setError(undefined);
    setError(await chooseSample(id));
    setBusy("");
  };
  const read = async () => {
    setBusy("read"); setError(undefined);
    const result = await readOrder();
    setBusy("");
    if (!result.ok) { setError(result.message); return; }
    announceRead(result.data, onToast);
  };

  return (
    <Card span={6} title="Purchase order" meta="PDF or JPEG, up to 10 MiB. Reads the file once.">
      <div aria-busy={busy !== ""}>
        <div className="file">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v4h4" /></svg>
          <b>{lot.file?.name ?? "No order chosen"}</b>
          <span style={{ marginLeft: "auto" }}>{lot.extraction ? <Chip>Read</Chip> : <Chip tone="none">Not read</Chip>}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }} role="group" aria-labelledby="nl-samples">
          <span className="lb" id="nl-samples" style={{ flexBasis: "100%" }}>Approved orders</span>
          {SAMPLES.map((sample) => (
            <button key={sample.id} type="button" className={`chp${lot.file?.sample === sample.id ? " on" : ""}`}
              aria-pressed={lot.file?.sample === sample.id} disabled={busy !== ""} onClick={() => pickSample(sample.id)}>
              {sample.label}
            </button>
          ))}
          <button type="button" className="chp" disabled={busy !== ""} onClick={() => fileInput.current?.click()}>Upload a file</button>
          <input ref={fileInput} type="file" accept="application/pdf,image/jpeg" hidden
            onChange={(event) => { const file = event.target.files?.[0]; if (file) setError(chooseUpload(file)); event.target.value = ""; }} />
        </div>
        <div className="ctx" role="group" aria-label="Order context, entered by the operator">
          <label>Order ID
            <FieldInput id="nl-order-id" label="Order ID" value={lot.context.orderId} placeholder="As on the order" required
              onChange={(value) => changeContext("orderId", value)} />
          </label>
          <label>Paper type
            <FieldSelect id="nl-paper-type" label="Paper type" value={lot.context.paperType} placeholder="Select" options={PAPER_TYPES}
              onChange={(value) => changeContext("paperType", value)} />
          </label>
          <label>Paper supplier
            <FieldSelect id="nl-paper-supplier" label="Paper supplier" value={lot.context.paperSupplier} placeholder="Select" options={SUPPLIERS}
              onChange={(value) => changeContext("paperSupplier", value)} />
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
          <Button small onClick={read} disabled={busy !== "" || !lot.file || !contextReady}>
            {busy === "read" ? "Reading the order" : "Read order with Gemini"}
          </Button>
          <span className="lb" style={{ fontSize: 13 }}>
            {!lot.file ? "Pick an approved order or upload one." : !contextReady ? "Enter the order ID and the loaded paper first." : "Gemini reads the file once; the catalog match runs in code."}
          </span>
        </div>
        {error && <p className="err" role="alert">{error}</p>}
      </div>
    </Card>
  );
}

function announceRead(extraction: Extraction, show: ReturnType<typeof useToasts>["show"]) {
  if (extraction.lines.length > 1) {
    show({ id: "read", tone: "wn", title: "Check the source line", text: "Only the line you pick is in this lot." });
  } else if (extraction.needsClarification) {
    show({ id: "read", tone: "wn", title: "Check the order", text: "Some values need you before you confirm." });
  } else {
    show({ id: "read", tone: "ok", title: "Order read", text: "Check each value, then confirm." });
  }
}

function CatalogCard({ lot }: { lot: LotState }) {
  const line = selectedLine(lot);
  if (!line) {
    return (
      <Card span={6} title="Catalog match" meta={<ProvenanceChip kind="missing" />}>
        <p className="lb" style={{ margin: 0, fontSize: 15 }}>{lot.extraction ? "Pick the line to prepare." : "Read an order to match its item against the catalog."}</p>
      </Card>
    );
  }
  const matched = line.catalogStatus === "MATCHED" || line.status === "MATCHED";
  const checks: [boolean, string][] = [
    [matched, matched ? "Item code found" : line.catalogStatus === "AMBIGUOUS" ? "Matches more than one catalog item" : "Item code not in the catalog"],
    [line.orderProfile?.ply !== undefined, line.orderProfile?.ply !== undefined ? "Board and size come from the catalog" : "Board and size not found in the catalog"],
    [line.quantity !== undefined, line.quantity !== undefined ? "Quantity read from the order" : "Quantity missing on the order"],
  ];
  return (
    <section className="cd c6" style={{ display: "flex", flexDirection: "column" }} aria-labelledby="nl-catalog">
      <div className="ct"><h2 className="t" id="nl-catalog">Catalog match</h2><Chip tone="modeled">From catalog</Chip></div>
      <div className="n" style={{ fontSize: 36, lineHeight: "42px", fontWeight: 600, letterSpacing: "-.5px", overflowWrap: "anywhere" }}>{lot.itemCode || "No item code"}</div>
      <div className="lb" style={{ marginTop: 2 }}>{matched ? "In the plant's item catalog." : "Not matched in the plant's item catalog."}</div>
      {line.candidates.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }} role="group" aria-label="Catalog items this code matches">
          {line.candidates.map((code) => (
            <button key={code} type="button" className={`chp${lot.itemCode === code ? " on" : ""}`} aria-pressed={lot.itemCode === code}
              onClick={() => editOrderValue("itemCode", code)}>{code}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 16 }} />
      <ul style={{ borderTop: "1px solid var(--ln)", paddingTop: 6, margin: 0, listStyle: "none", paddingLeft: 0 }}>
        {checks.map(([ok, text], index) => (
          <li key={text} className={`ci ${ok ? "ok" : "wn"}`} style={{ minHeight: 44, fontSize: 16, borderTop: index ? "1px solid var(--ln)" : undefined }}>
            <StatusIcon kind={ok ? "ok" : "warn"} />{text}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceCard({ lot }: { lot: LotState }) {
  const extraction = lot.extraction;
  if (!extraction) {
    return (
      <Card span={6} title="Source" meta="No order read">
        <p className="lb" style={{ margin: 0, fontSize: 15 }}>The lines Gemini reads from the order appear here, with the one you pick highlighted.</p>
      </Card>
    );
  }
  const document = extraction.purchaseOrderDocument;
  const byGemini = extraction.source === "vertex-gemini" && extraction.isRealModelPrediction;
  return (
    <Card span={6} title="Source" meta={lot.lineIndex === undefined ? "Pick a line" : `Line ${lot.lineIndex + 1} is selected`}>
      <div className="po">
        <div className="hd"><b>PURCHASE ORDER</b><span style={{ fontSize: 13 }}>{document?.poNumber ?? "No PO number read"}</span></div>
        <div style={{ fontSize: 13, marginTop: 2 }}>{document?.buyer ?? "No customer read"}</div>
        <div className="row h" aria-hidden="true"><span>LINE</span><span>ITEM CODE</span><span>CATALOG</span><span>QTY</span></div>
        {extraction.lines.map((line) => (
          <div key={line.lineIndex} className={`row l${line.lineIndex === lot.lineIndex ? " on" : ""}`}>
            <span>{line.lineIndex + 1}</span>
            <span style={{ overflowWrap: "anywhere" }}>{line.extractedItemCode ?? "No code"}</span>
            <span>{LINE_STATUS[line.status]}</span>
            <span>{line.quantity === undefined ? "None" : formatNumber(line.quantity)}</span>
          </div>
        ))}
        <div className="ft">{byGemini ? "Read from the order by Gemini." : "Sample output, no model call."} Only the line you pick is in this lot.</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }} role="group" aria-labelledby="nl-line">
        <span className="lb" id="nl-line">Line to prepare</span>
        {extraction.lines.map((line) => (
          <button key={line.lineIndex} type="button" className={`chp${line.lineIndex === lot.lineIndex ? " on" : ""}`}
            aria-pressed={line.lineIndex === lot.lineIndex} onClick={() => chooseLine(line)}>Line {line.lineIndex + 1}</button>
        ))}
        <span className="lb" style={{ fontSize: 13 }}>{extraction.lines.length === 1 ? "The order has one line." : "Pick one line for this lot."}</span>
      </div>
    </Card>
  );
}

function ReadRow({ name, value, where, chip, edit }: { name: string; value: string | undefined; where: string; chip: "order" | "catalog" | "operator"; edit?: ReactNode }) {
  const missing = value === undefined || value === "";
  return (
    <div className="rd">
      <div className="k">{name}</div>
      <div>
        <div className="v" style={missing ? { color: "var(--mu)", fontWeight: 500 } : undefined}>{missing ? "Not read" : value}</div>
        <div className="w">{where}{edit}</div>
      </div>
      <div>
        {missing ? <ProvenanceChip kind="missing" />
          : chip === "order" ? <Chip>From order</Chip>
            : chip === "catalog" ? <Chip tone="modeled">From catalog</Chip>
              : <ProvenanceChip kind="entered-by-operator" />}
      </div>
    </div>
  );
}

function EditableValue({ field, lot, label }: { field: "itemCode" | "quantity"; lot: LotState; label: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <> &middot; <button type="button" className="lk" onClick={() => setOpen(true)} aria-label={`Edit ${label}`}>Edit</button></>;
  return (
    <span className="ed">
      <FieldInput id={`nl-edit-${field}`} label={label} value={lot[field]} placeholder={label} inputMode={field === "quantity" ? "numeric" : "text"}
        onChange={(value) => editOrderValue(field, value)} />
      <button type="button" className="lk" onClick={() => setOpen(false)}>Done</button>
    </span>
  );
}

function ReadCard({ lot }: { lot: LotState }) {
  const line = selectedLine(lot);
  const document = lot.extraction?.purchaseOrderDocument;
  const profile = line?.orderProfile;
  const page = line?.sourcePage ? `Page ${line.sourcePage}, line ${line.lineIndex + 1}` : line ? `Line ${line.lineIndex + 1}` : "No line picked";
  const catalogWhere = lot.itemCode ? `Catalog item ${lot.itemCode}` : "Catalog";
  const board = profile?.ply !== undefined
    ? `${profile.paperType ? `${titleCase(profile.paperType)} ` : ""}${profile.ply}-ply, ${profile.fluteProfile} flute` : undefined;
  const size = profile?.boxStyle && profile.lengthMm !== undefined
    ? `${profile.boxStyle}, ${profile.lengthMm} × ${profile.widthMm} × ${profile.heightMm} mm` : undefined;
  const codeEdited = line !== undefined && lot.itemCode !== lineCode(line);
  const quantityEdited = line !== undefined && lot.quantity !== (line.quantity === undefined ? "" : String(line.quantity));
  return (
    <Card span={6} title="What we read from the order" meta={lot.orderConfirmed ? <ProvenanceChip kind="confirmed-by-operator" /> : <Chip tone="modeled">Draft, not confirmed</Chip>}>
      {!lot.extraction ? <p className="lb" style={{ margin: 0, fontSize: 15 }}>Nothing read yet.</p> : (
        <>
          <ReadRow name="PO number" value={document?.poNumber} where="Order header" chip="order" />
          <ReadRow name="Item code" value={lot.itemCode} where={page} chip={codeEdited ? "operator" : "order"}
            edit={line && <EditableValue field="itemCode" lot={lot} label="Item code" />} />
          <ReadRow name="Quantity" value={lot.quantity && `${formatNumber(Number(lot.quantity))} boxes`} where={page} chip={quantityEdited ? "operator" : "order"}
            edit={line && <EditableValue field="quantity" lot={lot} label="Quantity" />} />
          <ReadRow name="Customer" value={document?.buyer} where="Order header" chip="order" />
          <ReadRow name="Board" value={board} where={catalogWhere} chip="catalog" />
          <ReadRow name="Box style and size" value={size} where={catalogWhere} chip="catalog" />
          <div className="lb" style={{ fontSize: 13, marginTop: 10, lineHeight: 1.45 }}>Editing a value marks the plan and approval out of date.</div>
        </>
      )}
    </Card>
  );
}

function ConfirmBar({ lot }: { lot: LotState }) {
  const problem = lot.extraction ? orderProblem(lot) : "Read the order first.";
  const ready = !problem && lot.checks.every(Boolean);
  return (
    <section className="cd c12 bar" style={{ display: "flex", alignItems: "center", gap: 32, padding: "14px 20px", flexWrap: "wrap" }} aria-label="Confirm the order">
      {CHECKS.map((text, index) => (
        <label key={text} className="ck" style={{ whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={lot.checks[index]} disabled={!!problem}
            onChange={(event) => updateLot((current) => {
              const checks = [...current.checks] as LotState["checks"];
              checks[index] = event.target.checked;
              return { checks, orderConfirmed: false };
            })} />
          {text}
        </label>
      ))}
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        {problem && lot.extraction && <span className="sx wn" style={{ whiteSpace: "normal" }}><StatusIcon kind="warn" />{problem}</span>}
        <Button disabled={!ready} onClick={() => { updateLot({ orderConfirmed: true }); location.hash = "#/new-lot/conditions"; }}>Confirm order</Button>
      </span>
    </section>
  );
}

export function NewLotOrder() {
  const lot = useLot();
  const { toasts, show, dismiss } = useToasts();
  const status = !lot.extraction ? "Order not read" : lot.orderConfirmed ? "Order confirmed" : "Order not confirmed";
  const next = !lot.extraction ? "Operator: read the order" : lot.orderConfirmed ? "Operator: enter conditions" : "Operator: confirm order";
  return (
    <NewLotPage step={1} sub="Check each value against the order before you confirm."
      ids={<IdsBar lot={lot} status={status} next={next} />} toasts={<Toasts toasts={toasts} dismiss={dismiss} />}>
      <div className="g">
        <PurchaseOrderCard lot={lot} onToast={show} />
        <CatalogCard lot={lot} />
        <SourceCard lot={lot} />
        <ReadCard lot={lot} />
        <ConfirmBar lot={lot} />
      </div>
    </NewLotPage>
  );
}
