import { useState } from "react";
import { Banner, Button, Card } from "../components/m";
import { planLot } from "./newlot/actions";
import { IdsBar, NewLotPage, StatusIcon, StatusRow, Toasts, useToasts } from "./newlot/parts";
import { ChangesTable, ScrapFigures } from "./newlot/plan-view";
import type { LotState } from "./newlot/store";

/**
 * The plan stopped at the explanation step (G3). The server returns the prediction and the
 * optimization it finished, but stores no draft, so approval stays held until planning
 * completes. "Retry explanation" runs the same plan again with the same idempotency key, so
 * it continues the same revision.
 */
export function NewLotRecovery({ lot }: { lot: LotState }) {
  const { outputs, message } = lot.partial!;
  const { toasts, dismiss } = useToasts([{ id: "partial", tone: "bd", title: "Explanation did not finish", text: "Numbers are kept. Retry or continue." }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const optimization = outputs.optimization!;
  const evidence = outputs.evidence;

  const retry = async () => {
    setBusy(true); setError(undefined);
    const result = await planLot();
    setBusy(false);
    // A full result replaces this page with the comparison; any failure stays here with its reason.
    if (!result.ok) setError(result.message);
  };

  return (
    <NewLotPage step={3} sub="Part of the analysis did not finish. The rest is kept."
      ids={<IdsBar lot={lot} status="Comparison kept, explanation missing" next="Supervisor: retry or hold" />}
      toasts={<Toasts toasts={toasts} dismiss={dismiss} />}>
      <div className="g">
        <Banner tone="warn" title="The explanation is not available."
          actions={<>
            <Button onClick={retry} disabled={busy}>{busy ? "Retrying" : "Retry explanation"}</Button>
            <Button variant="secondary" disabled aria-describedby="nl-continue-note">Continue with saved numbers</Button>
            <Button variant="secondary" disabled aria-describedby="nl-hold-note">Hold this lot</Button>
          </>}>
          The comparison is kept on this page. Approval is held.
        </Banner>
        {error && <p className="err c12" role="alert" style={{ margin: 0 }}>{error}</p>}
        <section className="cd kr c8" aria-labelledby="nl-finished">
          <div className="ct"><h2 className="t" id="nl-finished">What finished</h2></div>
          <StatusRow kind={outputs.prediction ? "ok" : "bad"} name="Defect estimate" state={outputs.prediction ? "Done" : "Not available"} height={48} />
          <StatusRow kind="ok" name="Limited search" state="Done" height={48} />
          <StatusRow kind={evidence ? "ok" : "bad"} name="Risk evidence" height={48}
            state={!evidence ? "Not available" : evidence.length === 0 ? "Done, no similar lots found" : `Done, ${evidence.length} similar ${evidence.length === 1 ? "lot" : "lots"} found`} />
          <StatusRow kind="bad" name="Explanation" state="Not available" height={48} />
          <div style={{ borderTop: "1px solid var(--ln)", marginTop: 6, paddingTop: 14 }}>
            <div className="th" style={{ marginBottom: 6 }}>Kept comparison</div>
            <ChangesTable changes={optimization.changes} rowHeight={46} />
            <div style={{ display: "flex", gap: 28, alignItems: "center", borderTop: "1px solid var(--ln)", paddingTop: 12, flexWrap: "wrap" }}>
              <span className="lb">Modeled scrap</span><ScrapFigures optimization={optimization} size={22} />
            </div>
          </div>
        </section>
        <div className="c4" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="What each choice does">
            <div style={{ padding: "14px 0", borderTop: "1px solid var(--ln)" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Retry explanation</div>
              <div className="lb" style={{ lineHeight: 1.45, marginTop: 4 }}>Plans the lot again with the same inputs. Nothing is approved.</div>
            </div>
            <div style={{ padding: "14px 0", borderTop: "1px solid var(--ln)" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Continue with saved numbers</div>
              <div className="lb" id="nl-continue-note" style={{ lineHeight: 1.45, marginTop: 4 }}>Not connected yet. A draft needs an explanation before it is stored.</div>
            </div>
            <div style={{ padding: "14px 0", borderTop: "1px solid var(--ln)" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Hold this lot</div>
              <div className="lb" id="nl-hold-note" style={{ lineHeight: 1.45, marginTop: 4 }}>Not connected yet. Nothing is approved in the meantime.</div>
            </div>
          </Card>
          <section className="cd" style={{ padding: "14px 20px" }}>
            <details>
              <summary style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
                Technical details<span className="lb">Reference and diagnostics</span>
              </summary>
              <p className="lb" style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                Stopped at: {outputs.blockedAt ?? "explanation"}. {message}
              </p>
            </details>
          </section>
        </div>
        <section className="cd c12 bar" style={{ display: "flex", gap: 28, alignItems: "center", padding: "14px 20px", flexWrap: "wrap" }}>
          <span className="sx wn"><StatusIcon kind="warn" />Approval is held while the explanation is missing.</span>
          <span className="lb">If an input changes, the kept comparison is marked out of date.</span>
        </section>
      </div>
    </NewLotPage>
  );
}
