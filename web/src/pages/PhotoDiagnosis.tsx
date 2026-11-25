import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Card, Chip, Icon, IdleMark, PageHeader, ProvenanceChip } from "../components/m";
import { getJson } from "../lib/api";
import specimen from "./photo/example-specimen.jpg";
import "./photo/photo.css";
import {
  classifyPhoto, defectName, diagnoseUpload, UPLOAD_ACCEPT, UPLOAD_REFUSED, uploadAllowed, writtenByGemini,
  type ApprovedPhotos, type Classification, type Label, type UploadDiagnosis,
} from "./photo/api";
import { SeenBeforeCard } from "./photo/SeenBefore";

type Photos = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; photos: ApprovedPhotos["photos"] };
type Source = { kind: "approved"; index: number } | { kind: "upload"; file: File; url: string };
type Outcome = { kind: "approved"; data: Classification } | { kind: "upload"; data: UploadDiagnosis };

const DASH = "–";

export function PhotoDiagnosis() {
  const [photos, setPhotos] = useState<Photos>({ state: "loading" });
  const [source, setSource] = useState<Source>({ kind: "approved", index: 0 });
  const [outcome, setOutcome] = useState<Outcome>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    getJson<ApprovedPhotos>("/evidence/approved-photos", controller.signal).then((r) => {
      if (controller.signal.aborted) return;
      setPhotos(r.ok && Array.isArray(r.data.photos) ? { state: "ready", photos: r.data.photos } : { state: "error", message: r.ok ? "No photo list came back." : r.error });
    });
    return () => controller.abort();
  }, []);
  useEffect(() => () => { if (source.kind === "upload") URL.revokeObjectURL(source.url); }, [source]);

  const choose = (next: Source) => { setSource(next); setOutcome(undefined); setError(undefined); };
  const pick = (file?: File) => {
    if (!file) return;
    if (!uploadAllowed(file)) { setError(UPLOAD_REFUSED); return; }
    choose({ kind: "upload", file, url: URL.createObjectURL(file) });
  };

  const approved = photos.state === "ready" && source.kind === "approved" ? photos.photos[source.index] : undefined;
  const canRun = !busy && !outcome && (source.kind === "upload" || Boolean(approved));

  const run = async () => {
    if (!canRun) return;
    setBusy(true); setError(undefined);
    if (source.kind === "upload") {
      const r = await diagnoseUpload(source.file);
      if (r.ok) setOutcome({ kind: "upload", data: r.data }); else setError(r.error);
    } else if (approved) {
      const r = await classifyPhoto(approved.id);
      if (r.ok) setOutcome({ kind: "approved", data: r.data }); else setError(r.error);
    }
    setBusy(false);
  };

  const label = outcomeLabel(outcome);

  return (
    <>
      <PageHeader title="Photo diagnosis" sub="Ten approved photos, or upload your own." actions={<Chip>Reads the file once</Chip>} />
      <div className="g">
        <section className="cd flush c8" aria-labelledby="pd-photo-title">
          <div className="pd-bar">
            <h2 id="pd-photo-title">
              {source.kind === "upload" ? "Uploaded photo" : photos.state === "ready" && approved ? `Approved photo ${source.index + 1} of ${photos.photos.length}` : "Approved photos"}
            </h2>
            <span className="mt">{source.kind === "upload" ? "Do not upload photos of people." : "Side view of a board cross-section"}</span>
          </div>
          <PhotoView photos={photos} source={source} />
          {photos.state === "ready" && photos.photos.length > 0 && (
            <div className="pd-thumbs" role="group" aria-label="Approved photos">
              {photos.photos.map((photo, index) => (
                <button key={photo.id} type="button" className="th2" aria-label={photo.label}
                  aria-pressed={source.kind === "approved" && source.index === index}
                  onClick={() => choose({ kind: "approved", index })}>{index + 1}</button>
              ))}
            </div>
          )}
        </section>

        <Card span={4} title="Diagnosis" meta={<Status busy={busy} done={Boolean(outcome)} failed={Boolean(error) && !outcome} />}>
          <Field name="Likely defect" outcome={outcome} value={likelyDefect(outcome)} />
          <Field name="What it looked at" outcome={outcome} value={lookedAt(outcome)} />
          <Field name="Suggested follow-up" outcome={outcome} value={followUp(outcome)} />
          {outcome && (
            <div className="pd-chips">
              <Chip>{outcome.kind === "upload" ? "Uploaded photo" : "Approved reference photo"}</Chip>
              {writtenByGemini(outcome.data) && <ProvenanceChip kind="generated-by-gemini" />}
            </div>
          )}
          {outcome?.kind === "upload" && (
            <p className="lb pd-msg" style={{ marginTop: 0 }}>Your photo, not an approved reference photo. The accuracy check was measured on the approved photos only.</p>
          )}
          <div className="pd-acts">
            <Button arrow onClick={run} disabled={!canRun}>{busy ? "Reading the photo" : "Run diagnosis"}</Button>
            <Button variant="secondary" onClick={() => picker.current?.click()} disabled={busy}>Other photo</Button>
            <input ref={picker} type="file" accept={UPLOAD_ACCEPT} hidden aria-label="Choose a photo to upload"
              onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          {error && <p className="pd-msg bad" role="alert">{error}</p>}
        </Card>

        {label !== undefined && <SeenBeforeCard label={label} />}

        <section className="cd kr c12" aria-labelledby="pd-trust-title">
          <div className="ct"><h2 className="t" id="pd-trust-title">How far to trust this</h2><ProvenanceChip kind="not-connected" /></div>
          <div className="pd-trust">
            <p className="lb" style={{ margin: 0, maxWidth: 520, lineHeight: 1.5 }}>The stored accuracy run over the ten approved photos is not connected yet, so no match count is shown.</p>
            <div className="ncbar" aria-hidden="true" />
            <div className="lb" style={{ marginLeft: "auto", maxWidth: 360, lineHeight: 1.5 }}>A small check, not an inspection tool.</div>
          </div>
        </section>
      </div>
    </>
  );
}

function PhotoView({ photos, source }: { photos: Photos; source: Source }) {
  if (source.kind === "upload") {
    return <div className="pd-img upload"><img src={source.url} alt="The photo you chose to upload" /></div>;
  }
  if (photos.state !== "ready" || photos.photos.length === 0) {
    return (
      <div className="pd-img">
        <div className="pd-empty" role={photos.state === "error" ? "alert" : "status"}>
          {photos.state === "loading" && "Reading the approved photo list."}
          {photos.state === "error" && <><ProvenanceChip kind="not-connected" /><span>The approved photos could not be read. {photos.message}</span></>}
          {photos.state === "ready" && "No approved photos are registered."}
        </div>
      </div>
    );
  }
  // The server never sends approved photo bytes, so the design's specimen picture stands in, labelled as an example.
  return (
    <div className="pd-img">
      <img src={specimen} alt="Example side view of a corrugated board cross-section, not the selected approved photo" />
      <Chip tone="example">Example image, not the approved photo</Chip>
    </div>
  );
}

function Status({ busy, done, failed }: { busy: boolean; done: boolean; failed: boolean }) {
  if (busy) return <span className="sx id" role="status"><IdleMark />Reading the photo</span>;
  if (done) return <span className="sx ok"><Icon name="ok" />Done</span>;
  if (failed) return <span className="sx bd"><Icon name="bad" />Not run</span>;
  return <span className="sx id"><IdleMark />Not run yet</span>;
}

function Field({ name, outcome, value }: { name: string; outcome?: Outcome; value: ReactNode }) {
  return (
    <div className="pd-field">
      <div className="lb">{name}</div>
      <div className={`v${outcome ? "" : " idle"}`}>{outcome ? value : DASH}</div>
    </div>
  );
}

function outcomeLabel(outcome?: Outcome): Label | undefined {
  if (!outcome) return undefined;
  if (outcome.kind === "approved") return outcome.data.label;
  return outcome.data.recognised ? outcome.data.diagnosis?.label : undefined;
}

function likelyDefect(outcome?: Outcome) {
  if (!outcome) return DASH;
  if (outcome.kind === "approved") return defectName(outcome.data.label);
  const { recognised, diagnosis } = outcome.data;
  if (!recognised || !diagnosis) return "Not recognised as corrugated board";
  return diagnosis.label === "NONE" ? defectName("NONE") : `${defectName(diagnosis.label)}, ${diagnosis.severity.toLowerCase()} severity`;
}

function lookedAt(outcome?: Outcome) {
  if (!outcome) return DASH;
  if (outcome.kind === "approved") return "This check returns a label only.";
  const signs = outcome.data.diagnosis?.visibleSigns ?? [];
  return signs.length ? <ul>{signs.map((sign) => <li key={sign}>{sign}</li>)}</ul> : DASH;
}

function followUp(outcome?: Outcome) {
  if (!outcome) return DASH;
  if (outcome.kind === "upload" && !outcome.data.recognised) return outcome.data.message ?? "Take a closer photo of the affected sheet.";
  return outcomeLabel(outcome) === "NONE" ? "No defect seen. You can still search past lots below." : "Search past lots with this defect below.";
}
