import { useRef, useState } from "react";
import { Button, Card, Chip } from "../../ui/components";
import { Icon } from "../../ui/icons";
import { CheckLine } from "./parts";
import { PAPER_TYPES, SAMPLES, lineProblem, type LineChoice, type OrderContext } from "./model";
import type { Extraction } from "../../lib/session";

export type ReadState = "idle" | "reading" | "read" | "failed";
export type OrderSource = { kind: "sample"; id: string } | { kind: "upload"; name: string };

type Props = {
  source?: OrderSource; fileName?: string; readState: ReadState; readError?: string;
  extraction?: Extraction; lineIndex?: number; choice: LineChoice; context: OrderContext;
  checks: [boolean, boolean, boolean];
  onSample: (id: string) => void; onUpload: (file: File) => void;
  onLine: (index: number) => void; onChoice: (choice: LineChoice) => void; onContext: (context: OrderContext) => void;
  onCheck: (index: number, value: boolean) => void; onConfirm: () => void;
};

const DOC = "M6 3h8l4 4v14H6zM14 3v4h4";
const CHECKS = ["The source line is the one you want", "The quantity matches the order", "The catalog item is the right box"];
const readChip = { idle: "Not read", reading: "Reading", read: "Read", failed: "Not read" } as const;

function EditRow({ label, value, note, chip, chipKind, editing, onEdit, children }: {
  label: string; value: string; note: string; chip: string; chipKind: "confirmed" | "modeled" | "missing" | "example";
  editing?: boolean; onEdit?: () => void; children?: React.ReactNode;
}) {
  return (
    <div className="nl-read-row">
      <div className="nl-read-label">{label}</div>
      <div>
        {editing ? children : <div className="nl-read-value">{value}</div>}
        <div className="nl-read-note">{note}{onEdit && <> &middot; <button type="button" className="nl-edit" onClick={onEdit}>{editing ? "Done" : "Edit"}</button></>}</div>
      </div>
      <Chip kind={chipKind}>{chip}</Chip>
    </div>
  );
}

export function OrderStep(p: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<string>();
  const toggle = (key: string) => setEditing(editing === key ? undefined : key);
  const line = p.extraction?.lines.find((entry) => entry.lineIndex === p.lineIndex);
  const problem = lineProblem(line, p.choice);
  const doc = p.extraction?.purchaseOrderDocument;
  const matched = !!line && line.status === "MATCHED";
  const orderReady = !!p.extraction && !problem && p.context.orderId !== "" && p.context.paperType !== "" && p.context.paperSupplier !== "";
  const allChecked = p.checks.every(Boolean);
  const name = p.fileName;

  return (
    <div className="grid">
      <Card span={6} title="Purchase order" meta="PDF or JPEG, up to 10 MiB. Reads the file once.">
        <button type="button" className="nl-drop" onClick={() => input.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) p.onUpload(file); }}>
          <Icon path={DOC} />
          <span className="nl-drop-name">{name ?? "Choose a purchase order"}</span>
          <Chip kind={p.readState === "read" ? "confirmed" : "missing"}>{readChip[p.readState]}</Chip>
        </button>
        <input ref={input} type="file" hidden accept="application/pdf,image/jpeg"
          onChange={(event) => { const file = event.target.files?.[0]; if (file) p.onUpload(file); event.target.value = ""; }} />
        <div className="nl-samples">
          <span className="nl-label nl-samples-title">Approved samples</span>
          {SAMPLES.map((sample) => (
            <button key={sample.id} type="button" className="nl-pill" aria-pressed={p.source?.kind === "sample" && p.source.id === sample.id}
              onClick={() => p.onSample(sample.id)}>{sample.label}</button>
          ))}
        </div>
        {p.readState === "reading" && <p className="nl-note" role="status">Reading the order.</p>}
        {p.readError && <p className="nl-note nl-note-bad" role="alert">{p.readError}</p>}
      </Card>

      <Card span={6} title="Catalog match" meta={line ? <Chip kind="modeled">From catalog</Chip> : undefined}>
        {line ? (
          <>
            <div className="nl-big">{p.choice.code || "Not recorded"}</div>
            <div className="nl-label">In the plant's 117-item catalog.</div>
            <div className="nl-checks">
              <CheckLine ok={matched}>{matched ? "Item code found" : "Item code not confirmed"}</CheckLine>
              <CheckLine ok={false}>Board and size are not connected yet</CheckLine>
              <CheckLine ok={p.choice.quantity !== ""}>{p.choice.quantity !== "" ? "Quantity read from the order" : "Quantity not recorded"}</CheckLine>
            </div>
          </>
        ) : <p className="nl-label">Read a purchase order to match its item code against the catalog.</p>}
      </Card>

      <Card span={6} title="Source" meta={line ? `Line ${line.lineIndex + 1} is selected` : undefined}>
        {p.extraction ? (
          <>
            <div className="nl-paper">
              <div className="nl-paper-head"><b>PURCHASE ORDER</b><span>{doc?.poNumber ?? "Not recorded"}</span></div>
              <div className="nl-paper-sub">{doc?.buyer ?? "Not recorded"}</div>
              <div className="nl-paper-cols nl-paper-th"><span>LINE</span><span>ITEM CODE</span><span>QTY</span></div>
              {p.extraction.lines.map((entry) => (
                <button key={entry.lineIndex} type="button" aria-pressed={entry.lineIndex === p.lineIndex}
                  className={`nl-paper-cols nl-paper-line${entry.lineIndex === p.lineIndex ? " nl-paper-on" : ""}`} onClick={() => p.onLine(entry.lineIndex)}>
                  <span>{entry.lineIndex + 1}</span><span>{entry.extractedItemCode ?? "No code"}</span><span>{entry.quantity?.toLocaleString("en-IN") ?? "Not recorded"}</span>
                </button>
              ))}
              <div className="nl-paper-foot">Built from the fields read, not the original page.</div>
            </div>
            <div className="nl-line-pick"><span className="nl-label">Line to prepare</span>
              {p.extraction.lines.map((entry) => (
                <button key={entry.lineIndex} type="button" className="nl-pill" aria-pressed={entry.lineIndex === p.lineIndex} onClick={() => p.onLine(entry.lineIndex)}>Line {entry.lineIndex + 1}</button>
              ))}
            </div>
          </>
        ) : <p className="nl-label">The source line shows here once the order is read.</p>}
      </Card>

      <Card span={6} title="What we read from the order" meta={p.extraction ? <Chip kind="modeled">Draft, not confirmed</Chip> : undefined}>
        {p.extraction ? (
          <>
            <EditRow label="PO number" value={p.context.orderId || "Not recorded"} note="Page 1, header" chip={p.context.orderId ? "From order" : "Missing"} chipKind={p.context.orderId ? "confirmed" : "missing"}
              editing={editing === "po"} onEdit={() => toggle("po")}>
              <input className="nl-input" aria-label="PO number" value={p.context.orderId} onChange={(event) => p.onContext({ ...p.context, orderId: event.target.value })} />
            </EditRow>
            <EditRow label="Item code" value={p.choice.code || "Not recorded"} note={`Page ${line?.sourcePage ?? 1}, line ${(p.lineIndex ?? 0) + 1}`} chip="From order" chipKind="confirmed"
              editing={editing === "code"} onEdit={() => toggle("code")}>
              {line?.candidates?.length ? (
                <select className="nl-input" aria-label="Item code" value={p.choice.code} onChange={(event) => p.onChoice({ ...p.choice, code: event.target.value })}>
                  <option value="" disabled>Select the right item</option>{line.candidates.map((code) => <option key={code}>{code}</option>)}
                </select>
              ) : <input className="nl-input" aria-label="Item code" value={p.choice.code} onChange={(event) => p.onChoice({ ...p.choice, code: event.target.value })} />}
            </EditRow>
            <EditRow label="Quantity" value={p.choice.quantity ? `${Number(p.choice.quantity).toLocaleString("en-IN")} boxes` : "Not recorded"} note={`Page ${line?.sourcePage ?? 1}, line ${(p.lineIndex ?? 0) + 1}`} chip="From order" chipKind="confirmed"
              editing={editing === "qty"} onEdit={() => toggle("qty")}>
              <input className="nl-input" aria-label="Quantity" inputMode="numeric" value={p.choice.quantity} onChange={(event) => p.onChoice({ ...p.choice, quantity: event.target.value })} />
            </EditRow>
            <EditRow label="Customer" value={doc?.buyer ?? "Not recorded"} note="Page 1, header" chip={doc?.buyer ? "From order" : "Missing"} chipKind={doc?.buyer ? "confirmed" : "missing"} />
            <EditRow label="Board" value="Not recorded" note="The catalog is not connected yet" chip="Missing" chipKind="missing" />
            <EditRow label="Box style and size" value="Not recorded" note="The catalog is not connected yet" chip="Missing" chipKind="missing" />
            {!p.context.paperType || !p.context.paperSupplier || editing === "paper" ? (
              <EditRow label="Paper" value="Not recorded" note="Needed to plan the lot" chip="Missing" chipKind="missing" editing onEdit={undefined}>
                <div className="nl-pair">
                  <select className="nl-input" aria-label="Paper type" value={p.context.paperType} onChange={(event) => p.onContext({ ...p.context, paperType: event.target.value })}>
                    <option value="" disabled>Paper type</option>{PAPER_TYPES.map((type) => <option key={type}>{type}</option>)}
                  </select>
                  <input className="nl-input" aria-label="Paper supplier" placeholder="Supplier code" value={p.context.paperSupplier} onChange={(event) => p.onContext({ ...p.context, paperSupplier: event.target.value })} />
                </div>
              </EditRow>
            ) : (
              <EditRow label="Paper" value={`${p.context.paperType.toLowerCase()}, ${p.context.paperSupplier}`} note="Approved sample record" chip="Sample" chipKind="example" />
            )}
            <div className="nl-label nl-foot">Editing a value marks the plan and approval out of date.</div>
          </>
        ) : <p className="nl-label">The values read from the order show here.</p>}
      </Card>

      <section className="card span-12 nl-confirm">
        {CHECKS.map((text, index) => (
          <label key={text} className="nl-check">
            <input type="checkbox" checked={p.checks[index]} disabled={!orderReady} onChange={(event) => p.onCheck(index, event.target.checked)} />
            <i aria-hidden="true">{p.checks[index] && <Icon path="M5 12.5l4.5 4.5L19 7" />}</i>
            {text}
          </label>
        ))}
        <span className="nl-confirm-end"><Button disabled={!orderReady || !allChecked} onClick={p.onConfirm}>Confirm order</Button></span>
      </section>
    </div>
  );
}
