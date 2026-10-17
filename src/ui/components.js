import { isRiskDisplay, isOptimizationDisplay, isSeenBefore } from "./contracts.js";
import { markMoney, refreshMoney } from "./currency-display.js";
import { DEFECT_NAMES, LEVER_FIELDS, LEVER_UNITS, MANUFACTURING_STAGES } from "./fields.js";
import { request, createRequestGate } from "./api.js";

const byId = (id) => document.getElementById(id);
const node = (tag, text, cls) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (cls) element.className = cls;
  return element;
};
export const number = (value, max = 2) => Number.isFinite(value)
  ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: max }).format(value) : "Unavailable";
export const money = (value, currency = "INR") => Number.isFinite(value)
  ? new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value) : "Unavailable";
const fieldLabels = {runDate:"Run date",shift:"Shift",ambientRhPct:"Relative humidity (%)",ambientTempC:"Ambient temperature (°C)",paperMoisturePct:"Paper moisture (%)",kg:"Scrap reduction (kg)",inr:"Predicted savings (INR)",percent:"Savings (%)"};
const labelFor = (key) => fieldLabels[key] ?? LEVER_FIELDS.find((f) => f[0] === key)?.[1] ?? key.replace(/([A-Z])/g, " $1");
const valueFor = (key, value) => value === null || value === undefined ? "Unavailable"
  : (typeof value === "number" ? number(value) : String(value)) + (LEVER_UNITS[key] ? " " + LEVER_UNITS[key] : "");
let toastTimer;
export function toast(message) {
  clearTimeout(toastTimer);
  const target = byId("toast-region");
  target.textContent = message;
  toastTimer = setTimeout(() => { target.textContent = ""; }, 5500);
}
export function initShell() {
  const panels = [...document.querySelectorAll("[data-screen-panel]")];
  const links = [...document.querySelectorAll("[data-screen-link]")];
  function showScreen(focus = false) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = ""; }
    const target = byId(id);
    const panel = target?.matches("[data-screen-panel]") ? target : target?.closest("[data-screen-panel]") ?? panels.find((candidate) => candidate.hasAttribute("data-default-screen")) ?? panels[0];
    panels.forEach((candidate) => { candidate.hidden = candidate !== panel; candidate.classList.toggle("is-active", candidate === panel); });
    links.forEach((link) => { if (link.hash === "#" + panel.id) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current"); });
    document.title = (links.find((link) => link.hash === "#" + panel.id)?.textContent.trim() ?? "Production preparation") + " · Momentum";
    if (!location.hash || !target) history.replaceState(null, "", "#" + panel.id);
    if (focus) {
      const heading = target && target !== panel ? target : panel.querySelector("h1");
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: "start" });
    }
    document.dispatchEvent(new CustomEvent("ustaad:navigation", { detail: panel.id }));
  }
  window.addEventListener("hashchange", () => showScreen(true));
  showScreen();
  for (const [buttonId, dialogId] of [["open-status", "status-dialog"], ["open-session", "session-dialog"]]) {
    byId(buttonId).addEventListener("click", () => byId(dialogId).showModal());
  }
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  });
}
export function renderRisk(payload, outputId = "risk-result") {
  const risk = payload.ratesPct ? payload : payload.risk;
  if (!isRiskDisplay(risk)) {
    throw new Error("The risk response is incomplete. No prediction has been displayed.");
  }
  const target = byId(outputId === "risk-result" ? "risk-metrics" : "what-if-metrics");
  target.replaceChildren();
  // Every defect uses the same fixed 0–25% domain from the API schema.
  const scaleNote = node("p", "Predicted scrap by defect · common scale 0–25%", "muted small");
  target.append(scaleNote);
  for (const [key, name] of Object.entries(DEFECT_NAMES)) {
    const row = node("div", undefined, "risk-row");
    row.dataset.primary = String(risk.primaryDefect === key);
    const track = node("div", undefined, "bar-track");
    track.setAttribute("aria-hidden", "true");
    const fill = node("div", undefined, "bar-fill");
    fill.style.width = Math.max(0, Math.min(100, risk.ratesPct[key] / 25 * 100)) + "%";
    track.append(fill);
    const label = node("span", name);
    // Om's caveat: the crack model has the weakest fit (D4, R² 0.30); flag it for monsoon conditions.
    if (key === "CRACK") label.append(node("small", "low confidence in monsoon", "risk-caveat"));
    row.append(label, track, node("strong", number(risk.ratesPct[key]) + "%"));
    target.append(row);
  }
  target.hidden = false;
  if (outputId === "risk-result") {
    const overview = byId("risk-overview");
    overview.replaceChildren();
    for (const [label, value] of [["Predicted scrap", Number.isFinite(risk.totalScrapPct) ? number(risk.totalScrapPct) + "%" : "Unavailable"], ["Predicted scrap mass", Number.isFinite(risk.totalScrapKg) ? number(risk.totalScrapKg) + " kg" : "Unavailable"], ["Estimated scrap cost", money(risk.scrapCost, risk.currency)]]) {
      const item = node("div"); item.append(node("strong", value), node("span", label)); overview.append(item);
    }
    if (Number.isFinite(risk.scrapCost)) markMoney(overview.lastElementChild.querySelector("strong"), risk.scrapCost, risk.currency);
    overview.hidden = false;
    refreshMoney();
  }
}
export function renderComparison(payload) {
  if (!isOptimizationDisplay(payload)) throw new Error("The recommendation response is incomplete.");
  const target = byId("optimization-settings");
  target.replaceChildren();
  const wrap = node("div", undefined, "table-scroll");
  wrap.tabIndex = 0; wrap.setAttribute("role", "region"); wrap.setAttribute("aria-label", "Planned and recommended settings");
  const table = node("table", undefined, "comparison-table");
  const caption = node("caption", "Planned vs recommended · model estimates; see Job card for approval status");
  const head = node("thead"); const headings = node("tr");
  for (const title of ["Machine setting", "Your plan", "Recommended"]) { const cell = node("th", title); cell.scope = "col"; headings.append(cell); }
  head.append(headings); const body = node("tbody");
  for (const [key, title] of LEVER_FIELDS) {
    const row = node("tr");
    const label = node("td", title);
    if (payload.baseline.levers[key] !== payload.best.levers[key]) {
      row.className = "changed";
      label.append(node("span", "Changed", "setting-change-note"));
    }
    row.append(label, node("td", valueFor(key, payload.baseline.levers[key])), node("td", valueFor(key, payload.best.levers[key])));
    body.append(row);
  }
  table.append(caption, head, body); wrap.append(table); target.append(wrap);
  const outcomeWrap = node("div", undefined, "table-scroll"); outcomeWrap.tabIndex = 0; outcomeWrap.setAttribute("role", "region"); outcomeWrap.setAttribute("aria-label", "Predicted plan and recommendation outcomes");
  const outcomeTable = node("table"); const outcomeHead = node("thead"); const outcomeHeading = node("tr");
  ["Predicted outcome", "Your plan", "Recommended"].forEach((text) => { const th=node("th",text);th.scope="col";outcomeHeading.append(th); }); outcomeHead.append(outcomeHeading);
  const outcomeBody=node("tbody");
  for (const [key,title,unit] of [["totalScrapPct","Total scrap","%"],["totalScrapKg","Scrap mass","kg"],["scrapCost","Scrap cost",""]]) {
    const row=node("tr"); row.append(node("td",title));
    for (const risk of [payload.baseline.risk,payload.best.risk]) { const cell=node("td",Number.isFinite(risk[key]) ? number(risk[key])+" "+unit : "Unavailable"); if(key==="scrapCost") markMoney(cell,risk[key],risk.currency); row.append(cell); }
    outcomeBody.append(row);
  }
  outcomeTable.append(outcomeHead,outcomeBody);outcomeWrap.append(outcomeTable);target.append(outcomeWrap);target.hidden = false;
  const changes = byId("optimization-changes"); changes.replaceChildren();
  if (!payload.changes.length) changes.append(node("p", "Your plan is already the best option we found.", "muted"));
  const reasons = node("ul", undefined, "change-reasons");
  payload.changes.forEach((change) => reasons.append(node("li", labelFor(change.lever) + ": " + change.reason)));
  changes.append(reasons);
  if (payload.note) changes.append(node("p", payload.note, "muted small"));
  if (payload.planBaselineLabel) changes.append(node("p", "Baseline: " + payload.planBaselineLabel, "muted small"));
  changes.hidden = false;
  const summary = byId("optimization-summary"); summary.replaceChildren();
  for (const [label, value] of [["Predicted net savings", money(payload.savings?.inr)], ["Predicted scrap reduction", Number.isFinite(payload.savings?.kg) ? number(payload.savings.kg) + " kg" : "Unavailable"], ...(Number.isFinite(payload.savings?.percent) ? [["Of planned cost", number(payload.savings.percent, 1) + "%"]] : [])]) {
    const item = node("div"); item.append(node("strong", value), node("span", label)); summary.append(item);
  }
  if (Number.isFinite(payload.savings?.inr)) markMoney(summary.firstElementChild.querySelector("strong"), payload.savings.inr);
  summary.hidden = false;
  refreshMoney();
}
export function renderStoredSheet(sheet) {
  const target = byId("stored-job-preview"); target.replaceChildren();
  byId("job-status-badge").textContent = sheet.status + " · " + sheet.jobId;
  target.append(node("h3", sheet.order.itemCode + " · " + number(sheet.order.quantity, 0) + " units"));
  target.append(node("p", "Stored order " + sheet.order.orderId + ". Recommended settings remain subject to the job’s approval status.", "muted small"));
  for (const [name, data] of [["Order specifications", sheet.order], ["Production conditions", sheet.conditions], ["Planned settings", sheet.baseline?.levers], ["Recommended settings", sheet.recommended?.levers], ["Planned predicted defect rates (%)", sheet.baseline?.risk?.ratesPct], ["Recommended predicted defect rates (%)", sheet.recommended?.risk?.ratesPct], ["Predicted savings", sheet.savings]]) {
    const collapsed = sheet.status !== "DRAFT" || (name !== "Recommended settings" && name !== "Production conditions");
    const section = node(collapsed ? "details" : "section", undefined, "document-preview__section"); section.append(node(collapsed ? "summary" : "h4", name));
    const list = node("dl", undefined, "field-list");
    for (const [key, value] of Object.entries(data ?? {})) {
      if (value === null || typeof value === "object") continue;
      const detail = node("dd", valueFor(key, value));
      if (key === "inr") markMoney(detail, value, "INR");
      list.append(node("dt", labelFor(key)), detail);
    }
    section.append(list); target.append(section);
  }
  const sequence = node("details", undefined, "document-preview__section");
  sequence.append(node("summary", "Manufacturing sequence and settings"));
  const scroll = node("div", undefined, "table-scroll");
  scroll.tabIndex = 0; scroll.setAttribute("role", "region"); scroll.setAttribute("aria-label", "Stored manufacturing sequence");
  const table = node("table", undefined, "manufacturing-sequence");
  table.append(node("caption", sheet.status === "APPROVED" ? "Stored approved job settings" : "Stored proposed settings · review and approval required"));
  const head = node("thead"); const heading = node("tr");
  for (const title of ["Step", "Manufacturing stage", "Stored settings"]) { const th = node("th", title); th.scope = "col"; heading.append(th); }
  head.append(heading); const body = node("tbody");
  MANUFACTURING_STAGES.forEach(([title, keys], index) => {
    const row = node("tr"); const settings = node("td");
    if (!keys.length) settings.textContent = "No adjustable setting in this job card";
    for (const key of keys) settings.append(node("span", labelFor(key) + ": " + valueFor(key, sheet.recommended?.levers?.[key]), "manufacturing-settings"));
    row.append(node("td", index + 1), node("td", title), settings); body.append(row);
  });
  table.append(head, body); scroll.append(table); sequence.append(scroll); target.append(sequence);
  target.append(node("p", sheet.explanation, "explanation")); target.hidden = false; refreshMoney();
}
const charts = new Map();
export function clearCharts() { for (const chart of charts.values()) chart.destroy(); charts.clear(); }
// Chart colours come from the active theme; charts redraw when the theme changes.
let lastImpactChartPayload;
document.addEventListener("ustaad:theme", () => { if (lastImpactChartPayload && charts.size) renderImpactCharts(lastImpactChartPayload); });
export function renderImpactCharts(payload) {
  clearCharts();
  lastImpactChartPayload = payload;
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  if (!window.Chart) { byId("impact-chart-status").textContent = "Charts are unavailable. All returned values remain available in the tables."; return; }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colors = [1, 2, 3, 4, 5].map((n) => token("--chart-" + n));
  const text = token("--chart-text"), muted = token("--muted"), grid = token("--chart-grid");
  const options = { responsive: true, maintainAspectRatio: false, animation: reduced ? false : { duration: 180 }, color: text, plugins: { legend: { labels: { color: text, boxWidth: 10, boxHeight: 10, font: { family: "Plex", size: 13 } } }, tooltip: { backgroundColor: token("--chart-tooltip"), borderColor: token("--line"), borderWidth: 1, titleColor: token("--text"), bodyColor: text } }, scales: { x: { ticks: { color: muted, font: { family: "Plex", size: 13 }, maxRotation: 0, maxTicksLimit: 10 }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: muted, font: { family: "Plex", size: 13 } }, grid: { color: grid } } } };
  const monthly = [...payload.monthly].sort((a, b) => a.month.localeCompare(b.month));
  if (monthly.length) {
    charts.set("monthly", new Chart(byId("impact-monthly-chart"), { type: "line", data: { labels: monthly.map((r) => r.month), datasets: [{ label: "Historical scrap cost (" + payload.kpis.currency + ")", data: monthly.map((r) => r.scrapCost), borderColor: colors[0], backgroundColor: colors[0] + "14", borderWidth: 2, pointRadius: 3, tension: 0, fill: true }, { label: "Agent settings · modelled counterfactual", data: monthly.map((r) => r.month === payload.counterfactual.month ? payload.counterfactual.scrapCost : null), borderColor: colors[1], backgroundColor: colors[1], pointRadius: 6, showLine: false }] }, options: { ...options, scales: { ...options.scales, y: { ...options.scales.y, title: { display: true, text: "Scrap cost (" + payload.kpis.currency + ")", color: muted } } } } }));
  }
  if (payload.seasonal.length) {
    charts.set("seasonal", new Chart(byId("impact-seasonal-chart"), { type: "bar", data: { labels: payload.seasonal.map((r) => r.season), datasets: ["warp", "delam", "strength", "print", "crack"].map((key, index) => ({ label: DEFECT_NAMES[key.toUpperCase()], data: payload.seasonal.map((r) => r[key]), backgroundColor: colors[index], borderRadius: 2 })) }, options: { ...options, scales: { ...options.scales, y: { ...options.scales.y, title: { display: true, text: "Average scrap (%)", color: muted } } } } }));
  }
  byId("impact-chart-status").textContent = monthly.length ? "A single counterfactual point is shown only for the held-out month. Exact values follow below." : "No monthly history returned. No chart values were substituted.";
}

const svgNode = (tag, attrs = {}, text) => { const el = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,String(value)); if (text !== undefined) el.textContent=String(text); return el; };
function comparisonPlot(values, { max, unit = "%", height = 160 } = {}) {
  const ceiling = max ?? Math.max(1,...values.filter(Number.isFinite));
  const svg = svgNode("svg", {viewBox:`0 0 420 ${height}`,class:"premium-comparison-plot","aria-hidden":"true"});
  const left=24,right=396,width=right-left;
  for(let i=0;i<=4;i++){const x=left+width*i/4;svg.append(svgNode("line",{x1:x,y1:16,x2:x,y2:height-28,class:"premium-chart-grid"}));svg.append(svgNode("text",{x,y:height-5,"text-anchor":i===0?"start":i===4?"end":"middle",class:"premium-axis-label"},number(ceiling*i/4)+unit));}
  values.forEach((value,index)=>{if(!Number.isFinite(value))return;const y=height===160?48+index*58:20+index*20;const x=left+width*value/ceiling;svg.append(svgNode("line",{x1:left,y1:y,x2:x,y2:y,class:index===0?"premium-series-good-line":"premium-series-bad-line"}));svg.append(svgNode("circle",{cx:x,cy:y,r:height===160?8:5,class:index===0?"premium-series-good":"premium-series-bad"}));});return svg;
}
function renderPremiumHistory(payload,defect,rh,target){
 const groups=[["good","Good runs",payload.goodRuns],["bad","Bad runs",payload.badRuns]];
 const kpis=node("div",undefined,"di-kpis premium-kpis");
 for(const[key,title,value,context]of[["cases","Matching historical cases",number(payload.caseCount,0),"Selected primary defect · RH window ±10 pp"],["rate","Historical average defect rate",number(payload.avgRateWhenMain)+"%","Mean for the primary-defect cases"],["cost","Historical scrap cost",money(payload.costWhenMain,"INR"),"Aggregate cost of those lots · base INR"]]){const card=node("section",undefined,"di-kpi premium-kpi premium-kpi-"+key);const titleNode=node("h3",title);const v=node("strong",value);v.dataset.evidenceKpi=key;card.append(titleNode,v,node("p",context));kpis.append(card);}target.append(kpis);
 const scope=node("p","Different cohorts: primary-defect cases and the Good/Bad comparison groups are not the same population.","di-scope-note");scope.id="evidence-scope-note";target.append(scope);
 const definitions=node("details",undefined,"premium-method");definitions.append(node("summary","How the historical cohorts are defined"),node("p","Matching cases require the selected primary defect within ±10 humidity points. Good/Bad groups use all humidity-matched lots ranked by the selected defect’s rate, including other primary defects. Counts are not parts of the matching-case total. Approximate quartile ties change group sizes; Good takes precedence when thresholds overlap."));target.append(definitions);
 byId("di-query-context").textContent=DEFECT_NAMES[defect]+" · requested RH "+number(rh)+"% · BigQuery history";
 const plots=node("div",undefined,"di-chart-grid premium-evidence-grid"),rates=node("section",undefined,"di-chart-card premium-rate-card");rates.append(node("p","HISTORICAL COHORTS","eyebrow"),node("h3","One defect. Two historical groups."));
 const legend=node("div",undefined,"premium-rate-legend");for(const[key,label,g]of groups){const item=node("div",undefined,"premium-legend-"+key);item.append(node("span",label));const value=node("strong",g?number(g.avgRatePct)+"%":"Unavailable");if(g)value.dataset.rateValue=String(g.avgRatePct);item.append(value,node("small",g?number(g.lots,0)+" observations":"No group returned"));legend.append(item);}rates.append(legend,comparisonPlot(groups.map(([, ,g])=>g?.avgRatePct)),node("p","Average defect rate (%) · zero-based scale. Groups are selected by rate; this is descriptive, not a treatment effect.","premium-caveat"));plots.append(rates);
 const conditions=node("details",undefined,"di-chart-card premium-condition-details");conditions.open=!matchMedia("(max-width:600px)").matches;conditions.append(node("summary","Operating conditions · compare groups"),node("p","Bronze: Good runs · Slate: Bad runs. Each measure uses its own zero-based scale.","premium-caveat"));
 for(const[key,label,unit]of[["sfSpeedMpm","Single facer speed","m/min"],["rollTempC","Roll temperature","°C"],["gumViscositySec","Gum viscosity","s"],["dryingHours","Drying time","h"],["printSpeedSpm","Print speed","sheets/min"]]){const row=node("div",undefined,"di-condition-row premium-condition-row");row.append(node("h4",label));const values=node("div",undefined,"premium-condition-values");for(const[k,label,g]of groups){const pair=node("div",undefined,"di-pair di-"+k);pair.append(node("span",label),node("strong",Number.isFinite(g?.[key])?number(g[key])+" "+unit:"Unavailable"));values.append(pair);}row.append(values,comparisonPlot(groups.map(([, ,g])=>g?.[key]),{unit:"",height:90}));conditions.append(row);}
 const categories=node("div",undefined,"di-categories");for(const[key,label]of[["gumApplication","Gum application"],["pastingPressure","Pasting pressure"]]){const row=node("div",undefined,"di-category-row");row.append(node("span",label));for(const[,name,g]of groups)row.append(node("span",name+": "+(g?.[key]??"Unavailable"),"di-chip"));categories.append(row);}conditions.append(categories);plots.append(conditions);target.append(plots);
 if(payload.goodRuns&&payload.badRuns){const insight=node("section",undefined,"di-insights premium-insights");insight.append(node("h3","What previous runs show"));const list=node("ul");for(const text of [number(payload.goodRuns.avgRatePct)+"% / "+number(payload.badRuns.avgRatePct)+"% average defect rate. Groups are defined by their historical rates.","Drying averages "+number(payload.goodRuns.dryingHours)+" h / "+number(payload.badRuns.dryingHours)+" h (Good / Bad).","Gum application: "+payload.goodRuns.gumApplication+" / "+payload.badRuns.gumApplication+". Pasting pressure: "+payload.goodRuns.pastingPressure+" / "+payload.badRuns.pastingPressure+"."])list.append(node("li",text));insight.append(list,node("p","Historical group differences are not causal machine-setting recommendations.","premium-caveat"));target.append(insight);}
      if (payload.goodRuns || payload.badRuns) {
        const details = node("details", undefined, "di-detail"); details.id = "detailed-evidence"; details.append(node("summary", "Detailed evidence · all original values"));
        const scroll = node("div", undefined, "table-scroll"); scroll.tabIndex = 0;
        const table = node("table"); const caption = node("caption", "Historical group averages · association, not a recommended setup");
        const head = node("thead"); const hr = node("tr"); ["Measure", "Good runs", "Bad runs"].forEach((text) => { const cell = node("th", text); cell.scope = "col"; hr.append(cell); }); head.append(hr); const body = node("tbody");
        for (const [key, title] of [["lots", "Lot count"], ["avgRatePct", "Average defect rate (%)"], ...LEVER_FIELDS.map(([key, title]) => [key, title])]) { const row = node("tr"); row.append(node("td", title), node("td", valueFor(key, payload.goodRuns?.[key])), node("td", valueFor(key, payload.badRuns?.[key]))); body.append(row); }
        table.append(caption, head, body); scroll.append(table); details.append(scroll); target.append(details);
      }

 const notes=node("details",undefined,"di-notes premium-notes");notes.open=!matchMedia("(max-width:600px)").matches;notes.append(node("summary","Operator observations · "+payload.notes.length+" returned notes"),node("p","Broader primary-defect history: not filtered by this humidity window. Operator statements are preserved verbatim, not verified causal conclusions.","premium-caveat"));if(payload.notes.length){const list=node("ul",undefined,"change-reasons");payload.notes.forEach(note=>list.append(node("li",note)));notes.append(list);}else notes.append(node("p","No operator notes returned."));target.append(notes);
}
export function renderPhotoPresentation(state,payload){
 const title=byId("photo-diagnosis-title"),badge=byId("photo-state-label"),metadata=byId("photo-result-metadata");metadata.replaceChildren();badge.textContent={idle:"Awaiting diagnosis",loading:"Processing approved image",success:"Gemini response received",error:"Diagnosis unavailable"}[state];title.textContent=state==="success"?({WARP:"Warp",DELAM:"Delamination",STRENGTH:"Strength",PRINT:"Print",CRACK:"Crack",NONE:"None"}[payload.label]):state==="loading"?"Inspecting the evidence":state==="error"?"Unable to complete diagnosis":"Ready when you are";title.dataset.state=state;
 if(state==="success")for(const[label,value]of[["Returned label",payload.label],["Approved photo",payload.photoId],["Provider model",payload.model??"Not supplied"],["Classified at",payload.classifiedAt??"Not supplied"]])metadata.append(node("dt",label),node("dd",value));
}
export function renderPremiumImpact(payload){
 const target=byId("premium-impact-comparison");target.replaceChildren();const{kpis,counterfactual}=payload;const copy=node("div",undefined,"premium-impact-story");copy.append(node("p","HELD-OUT COMPARISON","eyebrow"),node("h2","A clearer view of avoidable waste"),node("p","Same evaluated lot population. Baseline versus modelled agent settings, before the slower-production allowance.","premium-caveat"));const rates=node("div",undefined,"premium-rate-transition");rates.append(node("strong",number(kpis.scrapPctBefore)+"%"),node("span","→"),node("strong",number(kpis.scrapPctAfter)+"%"));copy.append(rates,node("p","Baseline / agent-settings scrap rate · estimates, not measured improvement","premium-caveat"));
 const chart=node("figure",undefined,"premium-cost-figure");chart.append(node("figcaption","Scrap cost comparison · base "+kpis.currency));const values=node("div",undefined,"premium-cost-values");for(const[label,val]of[["Held-out baseline",kpis.scrapCostBefore],["Agent settings · before allowance",kpis.scrapCostAfter]]){const item=node("div");item.append(node("span",label),node("strong",money(val,kpis.currency)));values.append(item);}chart.append(values);
 const max=Math.max(1,kpis.scrapCostBefore,kpis.scrapCostAfter)*1.12;const svg=svgNode("svg",{viewBox:"0 0 440 205",class:"premium-cost-svg","aria-hidden":"true"});for(let i=0;i<=3;i++){const y=170-i*48;svg.append(svgNode("line",{x1:48,y1:y,x2:422,y2:y,class:"premium-chart-grid"}),svgNode("text",{x:42,y:y+5,"text-anchor":"end",class:"premium-axis-label"},new Intl.NumberFormat("en-IN",{notation:"compact",maximumFractionDigits:1}).format(max*i/3)));}for(const[i,v]of[kpis.scrapCostBefore,kpis.scrapCostAfter].entries()){const height=v/max*144;svg.append(svgNode("rect",{x:90+i*180,y:170-height,width:100,height,rx:5,class:i===0?"premium-series-bad":"premium-series-good"}),svgNode("text",{x:140+i*180,y:195,"text-anchor":"middle",class:"premium-axis-label"},i===0?"Baseline":"Agent settings"));}chart.append(svg,node("p","After slower-production allowance: "+money(counterfactual.scrapCost,kpis.currency)+" modelled cost. Net saving "+money(kpis.netSavingMonth,kpis.currency)+" is reported separately; no annualization.","premium-caveat"));target.append(copy,chart);
 for(const el of document.querySelectorAll(".premium-seasonal,.premium-impact-breakdown"))el.open=!matchMedia("(max-width:600px)").matches;
}
export function initDefectCheck() {
  const tabs = [byId("di-tab-history"), byId("di-tab-photo")];
  const activate = (tab) => { for (const item of tabs) { const active = item === tab; item.setAttribute("aria-selected", String(active)); item.tabIndex = active ? 0 : -1; byId(item.getAttribute("aria-controls")).hidden = !active; } };
  tabs.forEach((tab, index) => { tab.addEventListener("click", () => activate(tab)); tab.addEventListener("keydown", (event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index; activate(tabs[next]); tabs[next].focus(); }); });
  const form = byId("seen-before-form"); const gate = createRequestGate();
  const clear = () => { gate.invalidate(); byId("seen-before-content").replaceChildren(); byId("seen-before-content").hidden = true; byId("di-query-context").textContent = "Inputs changed · search again"; };
  form.addEventListener("input", () => { clear(); byId("seen-before-result").textContent = "Inputs changed. Search again for these conditions."; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const active = gate.begin(); const button = byId("find-seen-before");
    const result = byId("seen-before-result"); const target = byId("seen-before-content");
    const defect = form.elements.defect.value;
    const ambientRhPct = Number(form.elements.ambientRhPct.value);
    target.replaceChildren(); target.hidden = true;
    button.disabled = true; button.setAttribute("aria-busy", "true");
    result.textContent = "Searching historical evidence…"; result.dataset.state = "loading";
    try {
      const { response, payload } = await request("/evidence/seen-before", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ defect, ambientRhPct }), signal: active.signal });
      if (!active.current()) return;
      byId("seen-before-result-diagnostic").textContent = JSON.stringify(payload, null, 2);
      if (!response.ok) throw new Error(payload?.error?.message || "Historical evidence is unavailable. Try again.");
      if (!isSeenBefore(payload) || payload.defect !== defect) throw new Error("The evidence response was incomplete. No cases were displayed.");
      renderPremiumHistory(payload, defect, ambientRhPct, target);
      target.hidden = false; result.textContent = payload.caseCount ? "Historical evidence returned by BigQuery. This is not photo classification." : "No matching cases were found. Missing historical groups remain unavailable."; result.dataset.state = "success";
    } catch (error) { if (active.current()) { result.textContent = error.message; result.dataset.state = "error"; } }
    finally { button.disabled = button.dataset.available !== "true"; button.removeAttribute("aria-busy"); }
  });
}
