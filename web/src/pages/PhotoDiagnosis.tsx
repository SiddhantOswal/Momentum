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
// `key` names the photo a request was made for: the approved photo's ID, or one key per upload.
type Source = { kind: "approved"; index: number } | { kind: "upload"; key: string; file: File; url: string };
type Outcome = { kind: "approved"; data: Classification } | { kind: "upload"; data: UploadDiagnosis };

const DASH = "–";

export function PhotoDiagnosis() {
  const [photos, setPhotos] = useState<Photos>({ state: "loading" });
  const [source, setSource] = useState<Source>({ kind: "approved", index: 0 });
  // Results and failures are kept per photo, so a late answer never shows under another photo.
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<string>();
  const [refusal, setRefusal] = useState<string>();
  const uploads = useRef(0);
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

  const choose = (next: Source) => { setSource(next); setRefusal(undefined); };
  const pick = async (file?: File) => {
    if (!file) return;
    if (!(await uploadAllowed(file))) { setRefusal(UPLOAD_REFUSED); return; }
    uploads.current += 1;
    choose({ kind: "upload", key: `upload-${uploads.current}`, file, url: URL.createObjectURL(file) });
  };

  const approved = photos.state === "ready" && source.kind === "approved" ? photos.photos[source.index] : undefined;
  const key = source.kind === "upload" ? source.key : approved?.id;
  const outcome = key ? outcomes[key] : undefined;
  const failure = key ? failures[key] : undefined;
  const busy = running !== undefined && running === key;
  // One diagnosis at a time, and none again for a photo that already has its result.
  const canRun = running === undefined && key !== undefined && !outcome;

  const run = async () => {
    if (!canRun || !key) return;
    const target = source;
    setRunning(key);
    setFailures(({ [key]: _, ...rest }) => rest);
    const r = target.kind === "upload" ? await diagnoseUpload(target.file) : await classifyPhoto(key);
    if (r.ok) {
      const result: Outcome = target.kind === "upload" ? { kind: "upload", data: r.data as UploadDiagnosis } : { kind: "approved", data: r.data as Classification };
      setOutcomes((all) => ({ ...all, [key]: result }));
    } else {
      setFailures((all) => ({ ...all, [key]: r.error }));
    }
    setRunning(undefined);
  };

  const label = outcomeLabel(outcome);
  const count = photos.state === "ready" ? photos.photos.length : undefined;

  return (
    <>
      <PageHeader title="Photo diagnosis" sub={count ? `${count} approved photos, or upload your own.` : "Approved photos, or upload your own."} actions={<Chip>Reads the file once</Chip>} />
      <div className="g">
        <section className="cd flush c8" aria-labelledby="pd-photo-title">
          <div className="pd-bar">
            <h2 id="pd-photo-title">
              {source.kind === "upload" ? "Uploaded photo" : approved ? `Approved photo ${source.index + 1} of ${count}` : "Approved photos"}
            </h2>
            <span className="mt">{source.kind === "upload" ? "Your photo, read once when you run it" : "Side view of a board cross-section"}</span>
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

        <Card span={4} title="Diagnosis" meta={<Status busy={busy} done={Boolean(outcome)} failed={Boolean(failure) && !outcome} />}>
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
            <Button variant="secondary" onClick={() => picker.current?.click()} disabled={running !== undefined} aria-describedby="pd-upload-note">Other photo</Button>
            <input ref={picker} type="file" accept={UPLOAD_ACCEPT} hidden aria-label="Choose a photo to upload" aria-describedby="pd-upload-note"
              onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <p className="lb pd-msg" id="pd-upload-note">Do not upload photos of people. JPEG, PNG or WebP, up to 8 MiB.</p>
          {refusal && <p className="pd-msg bad" role="alert">{refusal}</p>}
          {failure && !outcome && <p className="pd-msg bad" role="alert">{failure}</p>}
        </Card>

        {label !== undefined && <SeenBeforeCard label={label} />}

        <section className="cd kr c12" aria-labelledby="pd-trust-title">
          <div className="ct"><h2 className="t" id="pd-trust-title">How far to trust this</h2><ProvenanceChip kind="not-connected" /></div>
          <div className="pd-trust">
            <p className="lb" style={{ margin: 0, maxWidth: 520, lineHeight: 1.5 }}>The stored accuracy run over the {count ? `${count} ` : ""}approved photos is not connected yet, so no match count is shown.</p>
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
