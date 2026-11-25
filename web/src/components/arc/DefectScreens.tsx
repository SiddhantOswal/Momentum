import { useEffect, useId, useState } from "react";
import { formatNumber } from "../../lib/api";
import {
  arcWords, listApprovedPhotos, searchDefectHistory,
  type ApprovedPhoto, type Defect, type DefectHistory, type SettingsSummary,
} from "../../lib/arc";
import { Button, IdleMark, LabelChip, ProvenanceChip } from "../m";
import { Loading, NotConnectedNote, Problem, ScreenHead, Tabs, useArcScreen } from "./parts";

/*
 * Arc-Defect-Photo and Arc-Defect-History. Photos come from the approved-photo list route; a
 * diagnosis is an Arc turn, so its Gemini call goes through the turn runner and its budget.
 * History search reads the findSeenBefore command through its dashboard route, which needs no
 * Gemini call and returns the counts the results card shows.
 */

const DEFECTS: { key: Defect; name: string }[] = [
  { key: "WARP", name: "Warp" }, { key: "DELAM", name: "Delamination" }, { key: "STRENGTH", name: "Strength" },
  { key: "PRINT", name: "Print" }, { key: "CRACK", name: "Crack" },
];
// Centres of the humidity search; the server matches lots within its own band around the value.
const HUMIDITY = [30, 40, 50, 60, 70, 80, 90];

/** The order an approved photo has in the list, from its server label ("Approved photo 3"). */
const photoNumber = (photo: ApprovedPhoto, index: number) => photo.label.match(/\d+$/)?.[0] ?? String(index + 1);

function PhotoTab() {
  const { send, busy } = useArcScreen();
  const [photos, setPhotos] = useState<{ list?: ApprovedPhoto[]; words?: string } | null>(null);
  const [chosen, setChosen] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void listApprovedPhotos(controller.signal).then((read) => {
      if (!controller.signal.aborted) setPhotos(read.ok ? { list: read.data } : { words: arcWords(read.code) });
    });
    return () => controller.abort();
  }, []);

  if (!photos) return <Loading>Reading the approved photos</Loading>;
  if (!photos.list) return <Problem words={photos.words ?? arcWords("UNKNOWN")} />;
  if (!photos.list.length) return <section className="cd"><p className="lb" style={{ margin: 0, fontSize: 15 }}>No approved photos are listed.</p></section>;
  const photo = photos.list[chosen];
  const number = photoNumber(photo, chosen);
  return (
    <>
      <section className="cd flush" aria-label="Approved photos">
        <div className="ct2" style={{ minHeight: 44, padding: "6px 16px", margin: 0, borderBottom: "1px solid var(--ln)", flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Approved photo {number} of {photos.list.length}</span>
          <LabelChip label="Approved reference photo" />
        </div>
        <div className="pic">
          <span className="sx id" style={{ fontSize: 14 }}><IdleMark />The photo itself is not served to the browser yet, so it is not shown.</span>
        </div>
        <div className="thr" role="group" aria-label="Choose an approved photo">
          {photos.list.map((item, index) => (
            <button key={item.id} type="button" className="th2" aria-pressed={index === chosen}
              aria-label={item.label} onClick={() => setChosen(index)}>{photoNumber(item, index)}</button>
          ))}
        </div>
      </section>
      <section className="cd" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "14px 18px" }}>
        <div style={{ flex: "1 1 240px" }}>
          <div className="sx id" style={{ fontSize: 15 }}><IdleMark />Not run yet</div>
          <div className="lb" style={{ fontSize: 14, marginTop: 2 }}>How often the labels matched in testing is not connected yet.</div>
        </div>
        <Button arrow disabled={busy} onClick={() => send({ kind: "text", text: `Check approved photo ${photo.id}` }, `Check ${photo.label.toLowerCase()}`)}>Run diagnosis</Button>
      </section>
      <div className="drop">
        <LabelChip label="Uploaded photo" />
        <ProvenanceChip kind="not-connected" />
        <span>Uploading your own photo is not connected to Arc. Arc checks approved reference photos only.</span>
      </div>
    </>
  );
}

const shownSetting = (value: number | string) => typeof value === "number" ? formatNumber(value, 1) : value;
const SETTINGS: { key: keyof SettingsSummary; name: string; unit: string }[] = [
  { key: "sfSpeedMpm", name: "Single facer speed", unit: "m/min" }, { key: "rollTempC", name: "Roll temperature", unit: "°C" },
  { key: "gumApplication", name: "Gum application", unit: "" }, { key: "gumViscositySec", name: "Gum viscosity", unit: "s" },
  { key: "pastingPressure", name: "Pasting pressure", unit: "" }, { key: "dryingHours", name: "Drying time", unit: "h" },
  { key: "printSpeedSpm", name: "Print speed", unit: "sheets/min" },
];

function HistoryResult({ result, defectName, humidity }: { result: DefectHistory; defectName: string; humidity: number }) {
  if (result.caseCount === 0) {
    return (
      <section className="cd" role="status" style={{ minHeight: 140, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
        <span className="sx id" style={{ fontSize: 15 }}><IdleMark />No matching lots</span>
        <div className="lb" style={{ fontSize: 15, lineHeight: 1.5 }}>
          In modeled history, {defectName} was not the main problem in any lot near {humidity}% humidity. Try another defect or humidity.
        </div>
      </section>
    );
  }
  const { goodRuns, badRuns } = result;
  return (
    <section className="cd" role="status" aria-label="Search results">
      <div className="ct2"><h3 className="t">Similar lots</h3><ProvenanceChip kind="modeled-records" /></div>
      <div className="n" style={{ fontSize: 40, lineHeight: "46px", fontWeight: 600 }}>
        {formatNumber(result.caseCount)}<span style={{ fontSize: 18, color: "var(--mu)", marginLeft: 8, fontWeight: 500 }}>lots</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 16 }}>
        {defectName} was the main problem near {humidity}% humidity, at <b>{formatNumber(result.avgRateWhenMain, 2)}% of the lot</b> on average.
      </div>
      {goodRuns && badRuns && (
        <div role="table" aria-label="Average settings in the best and worst quarter of lots" style={{ marginTop: 14 }}>
          <div className="lb" style={{ fontSize: 14, marginBottom: 6 }}>
            {/* seen_before.sql: the lowest-rate and highest-rate quarters of every lot in the humidity band. */}
            Average settings of the {formatNumber(goodRuns.lots)} lots with the lowest {defectName} rate and the {formatNumber(badRuns.lots)} with the highest, near {humidity}% humidity.
          </div>
          <div role="row" className="tb h" style={{ gridTemplateColumns: "1fr 96px 96px" }}>
            <span role="columnheader" className="th">Setting</span>
            <span role="columnheader" className="th" style={{ textAlign: "right" }}>Lowest</span>
            <span role="columnheader" className="th" style={{ textAlign: "right" }}>Highest</span>
          </div>
          {SETTINGS.map(({ key, name, unit }) => (
            <div key={key} role="row" className="tb" style={{ gridTemplateColumns: "1fr 96px 96px", minHeight: 44 }}>
              <span role="cell" style={{ fontWeight: 600 }}>{name}{unit && <span className="lb"> {unit}</span>}</span>
              <span role="cell" className="n" style={{ textAlign: "right" }}>{shownSetting(goodRuns[key])}</span>
              <span role="cell" className="n" style={{ textAlign: "right" }}>{shownSetting(badRuns[key])}</span>
            </div>
          ))}
        </div>
      )}
      <div className="df"><span>They come from modeled history, not measured production.</span></div>
    </section>
  );
}

function HistoryTab() {
  const id = useId();
  const [defect, setDefect] = useState<Defect | "">("");
  const [humidity, setHumidity] = useState<number | "">("");
  const [search, setSearch] = useState<{ pending: boolean; result?: DefectHistory; words?: string; asked?: { defect: string; humidity: number } }>({ pending: false });
  const ready = defect !== "" && humidity !== "";

  const run = async () => {
    if (defect === "" || humidity === "") return;
    const asked = { defect: DEFECTS.find(({ key }) => key === defect)?.name ?? defect, humidity };
    setSearch({ pending: true, asked });
    const read = await searchDefectHistory({ defect, ambientRhPct: humidity });
    setSearch(read.ok ? { pending: false, result: read.data, asked } : { pending: false, words: arcWords(read.code), asked });
  };

  return (
    <>
      <section className="cd">
        <div className="ct2"><h3 className="t">Find similar lots</h3><ProvenanceChip kind="modeled-records" /></div>
        <div className="fgrid">
          <div>
            <label className="lb" htmlFor={`${id}-defect`} style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Defect</label>
            <div className={`fld${defect === "" ? " empty" : ""}`}>
              <select id={`${id}-defect`} value={defect} onChange={(event) => setDefect(event.target.value as Defect | "")}>
                <option value="">Choose a defect</option>
                {DEFECTS.map(({ key, name }) => <option key={key} value={key}>{name}</option>)}
              </select>
              <small aria-hidden="true">▾</small>
            </div>
          </div>
          <div>
            <label className="lb" htmlFor={`${id}-rh`} style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Humidity</label>
            <div className={`fld${humidity === "" ? " empty" : ""}`}>
              <select id={`${id}-rh`} value={humidity} onChange={(event) => setHumidity(event.target.value === "" ? "" : Number(event.target.value))}>
                <option value="">Choose a range</option>
                {HUMIDITY.map((value) => <option key={value} value={value}>Near {value}%</option>)}
              </select>
              <small aria-hidden="true">▾</small>
            </div>
          </div>
          <div>
            <label className="lb" htmlFor={`${id}-board`} style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Board</label>
            <div className="fld empty"><select id={`${id}-board`} disabled><option>Not connected</option></select><small aria-hidden="true">▾</small></div>
          </div>
          <div>
            <label className="lb" htmlFor={`${id}-date`} style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Run date</label>
            <div className="fld empty"><select id={`${id}-date`} disabled><option>Any date</option></select><small aria-hidden="true">▾</small></div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <Button arrow disabled={!ready || search.pending} onClick={run}>Search history</Button>
          <span className="lb" style={{ fontSize: 14 }}>
            {defect === "" ? "Pick a defect first." : humidity === "" ? "Pick a humidity." : "Board and run date filters are not connected yet."}
          </span>
        </div>
      </section>
      {search.pending && <Loading>Searching defect history</Loading>}
      {search.words && <Problem words={search.words} />}
      {search.result && search.asked && <HistoryResult result={search.result} defectName={search.asked.defect} humidity={search.asked.humidity} />}
      {!search.pending && !search.result && !search.words && (
        <section className="cd" style={{ minHeight: 160, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 6 }}>
          <span className="sx id" style={{ fontSize: 15 }}><IdleMark />No search yet</span>
          <div className="lb" style={{ fontSize: 15, lineHeight: 1.5 }}>Results count the lots that match. They come from modeled history, not measured production.</div>
        </section>
      )}
    </>
  );
}

/** "Check a defect": the photo and history tabs, opened after list_approved_photos succeeds. */
export function DefectCheck() {
  const [tab, setTab] = useState<"photo" | "history">("photo");
  return (
    <>
      <ScreenHead title="Check a defect" sub={tab === "photo" ? "Arc reads one approved photo at a time." : "Search past lots that match your conditions."} />
      <Tabs label="Defect check" selected={tab} onSelect={setTab}
        tabs={[{ key: "photo", text: "Photo diagnosis" }, { key: "history", text: "Historical evidence" }]} />
      {tab === "photo" ? <PhotoTab /> : <HistoryTab />}
    </>
  );
}

/**
 * A diagnosis the turn ran. The record is named, but the label Gemini gave is not returned to Arc
 * yet. The Gemini chip marks Gemini text on screen, and this card shows none, so it carries no chip.
 */
export function PhotoResult({ photoId }: { photoId: string }) {
  return (
    <section className="cd">
      <div className="ct2" style={{ flexWrap: "wrap" }}>
        <h3 className="t" style={{ fontSize: 15 }}>Photo diagnosis</h3>
        <span className="chips"><LabelChip label="Approved reference photo" /></span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{photoId}</div>
      <div style={{ marginTop: 10 }}>
        <NotConnectedNote>Arc checked this photo, but the label it found is not returned to Arc yet, so it is not shown.</NotConnectedNote>
      </div>
    </section>
  );
}
