import { useEffect, useRef, useState } from "react";
import { Button, Card, Chip, NotConnected, PageHeader, Status } from "../ui/components";
import { Icon } from "../ui/icons";
import { postJson } from "../lib/api";
import { useResource } from "../lib/useApp";
import { defectName, readApprovedPhotos, readClassification, type Classification } from "./photo-diagnosis/model";
import "./photo-diagnosis.css";

type Run = { state: "idle" } | { state: "running" } | { state: "done"; result: Classification } | { state: "failed"; message: string };

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="pd-row">
      <div className="pd-row-label">{label}</div>
      <div className={`pd-row-value${value ? " pd-row-value-set" : ""}`}>{value ?? "–"}</div>
    </div>
  );
}

export function PhotoDiagnosis() {
  const list = useResource<unknown>("/evidence/approved-photos");
  const photos = list.result?.ok ? readApprovedPhotos(list.result.data) : null;
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState<Run>({ state: "idle" });
  const active = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => active.current?.abort(), []);

  const photo = photos?.[index];

  function choose(next: number) {
    active.current?.abort();
    setIndex(next);
    setRun({ state: "idle" });
  }

  async function diagnose() {
    if (!photo) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setRun({ state: "running" });
    const response = await postJson<unknown>("/evidence/classify-photo", { photoId: photo.id }, controller.signal);
    if (controller.signal.aborted) return;
    if (!response.ok) return setRun({ state: "failed", message: response.error });
    const result = readClassification(response.data, photo.id);
    setRun(result ? { state: "done", result } : { state: "failed", message: "The diagnosis came back in a form Momentum does not accept." });
  }

  const unavailable = !list.loading && !photos;
  const status = run.state === "running" ? <Status tone="active">Running</Status>
    : run.state === "done" ? <Status tone="ok">Done</Status>
    : run.state === "failed" ? <Status tone="bad">Failed</Status>
    : <Status tone="idle">Not run yet</Status>;

  return (
    <>
      <PageHeader title="Photo diagnosis" subtitle="Ten approved photos only." actions={<Chip>Reads the file once</Chip>} />
      <div className="grid">
        <Card span={8} flush>
          <div className="pd-bar">
            <b>{photo ? `${photo.label} of 10` : "Approved photos"}</b>
          </div>
          <div className="pd-stage">
            {list.loading ? <NotConnected title="Loading the approved photos." />
              : unavailable ? <NotConnected title="The approved photo set is unavailable.">Check the connection and reload the page.</NotConnected>
              : <NotConnected title="The photo image is not connected.">The approved photos are classified from storage. Momentum does not serve the image to this page.</NotConnected>}
          </div>
          <div className="pd-thumbs" role="group" aria-label="Approved photos">
            {(photos ?? Array.from({ length: 10 }, (_, i) => ({ id: `photo-${i}`, label: String(i + 1) }))).map((item, position) => (
              <button key={item.id} type="button" className="pd-thumb" disabled={!photos}
                aria-pressed={position === index} aria-label={`Approved photo ${position + 1}`} onClick={() => choose(position)}>
                {position + 1}
              </button>
            ))}
          </div>
        </Card>
        <Card span={4} title="Diagnosis" meta={status}>
          <Row label="Likely defect" value={run.state === "done" ? defectName(run.result.label) : undefined} />
          <Row label="What it looked at" value={run.state === "done" ? "Not recorded" : undefined} />
          <Row label="Suggested follow-up" value={run.state === "done" ? "Not recorded" : undefined} />
          {run.state === "done" && <Chip kind="modeled">Model estimate</Chip>}
          {run.state === "failed" && <div className="pd-error"><NotConnected title="The diagnosis did not run.">{run.message}</NotConnected></div>}
          <div className="pd-actions">
            <Button disabled={!photo || run.state === "running"} onClick={diagnose}>
              {run.state === "running" ? "Running" : "Run diagnosis"}
              <Icon path="M5 12h14M13 6l6 6-6 6" />
            </Button>
            <Button variant="secondary" disabled={!photos} onClick={() => photos && choose((index + 1) % photos.length)}>Other photo</Button>
          </div>
        </Card>
        <Card span={12} kraft title="How far to trust this" meta="Ten approved test photos">
          <div className="pd-trust">
            <div className="pd-dots" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <span key={i} className="pd-dot" />)}</div>
            <div>
              <div className="pd-trust-figure">Not recorded</div>
              <div className="hm-label">No stored accuracy run for the ten photos.</div>
            </div>
            <div className="pd-trust-note">A small check, not an inspection tool.</div>
          </div>
        </Card>
      </div>
    </>
  );
}
