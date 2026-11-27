import { useLive } from "../lib/live";
import { useResource } from "../lib/useApp";
import { Hero } from "./home/Hero";
import { Activity, JobCardSummary, RunSteps, SampleOrders } from "./home/Lots";
import { ModelTrust } from "./home/ModelTrust";
import { ProductionRoute } from "./home/Route";
import { lowConfidence, newest, type JobResponse, type StatusResponse } from "./home/data";
import "./home/home.css";

/** Home (Main.png). Every figure comes from /api/lots and /api/live, /api/status or the newest
 * lot's job record; an element with no route shows the not-connected state. */
export function Home() {
  const { view } = useLive();
  const lots = view.lots;
  const latest = newest(lots);
  const draft = newest(lots, (lot) => lot.status === "planned");
  // A job record is readable only from the demo session that planned it; elsewhere it fails closed.
  const job = useResource<JobResponse>(latest?.jobId ? `/jobs/${encodeURIComponent(latest.jobId)}` : null);
  const draftJob = useResource<JobResponse>(draft?.jobId && draft.jobId !== latest?.jobId ? `/jobs/${encodeURIComponent(draft.jobId)}` : null);
  const status = useResource<StatusResponse>("/api/status");

  return (
    <div className="hm-page">
      <h1 className="sr-only">Home</h1>
      <div style={{ height: 24 }} />
      <div className="g">
        <Hero lots={lots} job={job.loading ? undefined : job.result} />
        <ProductionRoute lot={latest} />
        <SampleOrders lots={lots} job={job.result} />
        <JobCardSummary lot={draft} job={draft?.jobId === latest?.jobId ? job.result : draftJob.result} />
        <ModelTrust status={status.result} lowConfidence={lowConfidence(lots)} />
        <RunSteps lot={latest} job={job.result} />
        <Activity events={view.events} />
      </div>
    </div>
  );
}
