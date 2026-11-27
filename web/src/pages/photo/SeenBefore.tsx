import { useEffect, useId, useState } from "react";
import { Button, Card, IdleMark, Stat } from "../../components/m";
import { DEFECTS, formatMoney, formatNumber, getJson, type Defect } from "../../lib/api";
import { defectName, findSeenBefore, type Label, type SeenBefore as Result, type Weather } from "./api";

type Search = { state: "idle" } | { state: "busy" } | { state: "error"; message: string } | { state: "done"; defect: Defect; rh: number; result: Result };

/** Past modeled lots with the diagnosed defect at similar humidity, from `/evidence/seen-before`. */
export function SeenBeforeCard({ label }: { label: Label }) {
  const [defect, setDefect] = useState<Defect | "">(label === "NONE" ? "" : label);
  const [rh, setRh] = useState("");
  const [search, setSearch] = useState<Search>({ state: "idle" });
  const ids = { defect: useId(), rh: useId(), hint: useId() };

  useEffect(() => { setDefect(label === "NONE" ? "" : label); setSearch({ state: "idle" }); }, [label]);
  // The humidity starts from the public weather record and stays editable.
  useEffect(() => {
    const controller = new AbortController();
    getJson<Weather & { ok?: boolean }>("/conditions/weather", controller.signal).then((r) => {
      if (controller.signal.aborted || !r.ok || typeof r.data.ambientRhPct !== "number") return;
      setRh((current) => current || String(r.data.ambientRhPct));
    });
    return () => controller.abort();
  }, []);

  const rhValue = rh.trim() === "" ? NaN : Number(rh);
  const rhValid = Number.isFinite(rhValue) && rhValue >= 0 && rhValue <= 100;
  const hint = !defect ? "Pick a defect first." : !rhValid ? "Enter the humidity, from 0 to 100%." : undefined;

  const run = async () => {
    if (!defect || !rhValid) return;
    setSearch({ state: "busy" });
    const r = await findSeenBefore(defect, rhValue);
    setSearch(r.ok ? { state: "done", defect, rh: rhValue, result: r.data } : { state: "error", message: r.error });
  };

  return (
    <Card span={12} title="Seen before">
      <div className="pd-form">
        <label htmlFor={ids.defect}>Defect
          <select id={ids.defect} value={defect} onChange={(e) => { setDefect(e.target.value as Defect | ""); setSearch({ state: "idle" }); }}>
            <option value="">Choose a defect</option>
            {DEFECTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </label>
        <div>
          <label htmlFor={ids.rh}>Humidity, %
            <input id={ids.rh} inputMode="decimal" value={rh} aria-describedby={ids.hint}
              onChange={(e) => { setRh(e.target.value); setSearch({ state: "idle" }); }} />
          </label>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <Button onClick={run} disabled={Boolean(hint) || search.state === "busy"}>Search history</Button>
        <span className="lb" id={ids.hint}>{hint ?? ""}</span>
      </div>
      <div className="pd-res" aria-live="polite">
        <Outcome search={search} />
      </div>
    </Card>
  );
}

function Outcome({ search }: { search: Search }) {
  if (search.state === "idle") {
    return (
      <>
        <span className="sx id"><IdleMark />No search yet</span>
        <p className="lb" style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.5 }}>Results come from modeled history, not measured production.</p>
      </>
    );
  }
  if (search.state === "busy") return <span className="sx id" role="status">Searching past lots</span>;
  if (search.state === "error") return <p className="pd-msg bad" role="alert" style={{ margin: 0 }}>The history search failed. {search.message}</p>;

  const { result, defect, rh } = search;
  const name = defectName(defect);
  if (typeof result.caseCount !== "number") {
    return <p className="lb" style={{ margin: 0, fontSize: 15 }}>The history search returned no summary for {name}.</p>;
  }
  if (result.caseCount === 0) {
    return (
      <>
        <span className="sx id"><IdleMark />No past lots found</span>
        <p className="lb" style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.5 }}>
          No modeled lot near {formatNumber(rh, 1)}% humidity had {name.toLowerCase()} as its main defect.
        </p>
      </>
    );
  }
  return (
    <>
      <div className="pd-stats">
        <Stat label="Past lots" value={formatNumber(result.caseCount)} sub={`${name} was the main defect`} />
        <Stat label={`Average ${name.toLowerCase()} rate in those lots`} value={typeof result.avgRateWhenMain === "number" ? formatNumber(result.avgRateWhenMain, 2) : null} unit="%" />
        <Stat label="Scrap cost of those lots" value={typeof result.costWhenMain === "number" ? formatMoney(result.costWhenMain) : null} />
      </div>
      <p className="lb" style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.5 }}>
        Lots near {formatNumber(rh, 1)}% humidity. They come from modeled history, not measured production.
      </p>
    </>
  );
}
