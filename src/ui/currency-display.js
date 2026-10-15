import { formatDisplayCurrency } from "/display-currency.js";
import { request, createRequestGate } from "./api.js";

const ratesByBase = new Map();
const gate = createRequestGate();
function clearNote(element) {
  if (["TD", "DD"].includes(element.tagName)) element.querySelector(".fx-note")?.remove();
  else if (element.nextElementSibling?.matches(".fx-note")) element.nextElementSibling.remove();
}
function showNote(element, text) {
  const note = document.createElement("small"); note.className = "fx-note"; note.textContent = text;
  if (["TD", "DD"].includes(element.tagName)) element.append(note); else element.after(note);
}
export function markMoney(element, amount, currency = "INR") {
  if (!Number.isFinite(amount)) { element.textContent = "Unavailable"; return element; }
  element.dataset.moneyAmount = String(amount);
  element.dataset.moneyBase = currency;
  element.textContent = new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  return element;
}
export async function refreshMoney() {
  const active = gate.begin();
  const target = document.getElementById("display-currency").value;
  const items = [...document.querySelectorAll("[data-money-amount]")];
  await Promise.all(items.map(async (element) => {
    const base = element.dataset.moneyBase;
    const amount = Number(element.dataset.moneyAmount);
    const original = new Intl.NumberFormat("en-IN", { style: "currency", currency: base, maximumFractionDigits: 0 }).format(amount);
    clearNote(element);
    if (base === target) { element.textContent = original; element.title = "Base currency · no conversion"; return; }
    element.textContent = original;
    element.title = "Loading display conversion… Original amount retained.";
    try {
      const cacheKey = base + ":" + new Date().toISOString().slice(0, 10);
      if (!ratesByBase.has(cacheKey)) ratesByBase.set(cacheKey, request("/fx?base=" + encodeURIComponent(base), { headers: { Accept: "application/json" } }).then(({ response, payload }) => {
        if (!response.ok) throw new Error("FX unavailable"); return payload;
      }).catch((error) => { ratesByBase.delete(cacheKey); throw error; }));
      const rates = await ratesByBase.get(cacheKey);
      const converted = formatDisplayCurrency({ amount, from: base, to: target, language: "en", rates });
      if (!active.current() || !element.isConnected) return;
      element.textContent = "≈ " + converted.converted;
      const detail = "Rate " + converted.date + " · " + converted.source + (converted.stale ? " · stale" : "") + " · original " + original;
      element.title = detail;
      // The date and source remain visible, including for touch and screen-reader users.
      showNote(element, "Rate " + converted.date + (converted.stale ? " · stale" : "") + " · " + converted.source);
    } catch {
      if (!active.current() || !element.isConnected) return;
      element.textContent = original;
      element.title = "Display conversion unavailable. Original amount retained.";
      showNote(element, "Conversion unavailable · original " + base);
    }
  }));
}
