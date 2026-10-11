function amount(path, value, currency) {
  return { path, amount: value, currency };
}

function isRiskResult(value) {
  return value && typeof value === "object" &&
    Number.isFinite(value.scrapCost) &&
    Number.isFinite(value.totalScrapKg) &&
    typeof value.currency === "string" &&
    /^[A-Z]{3}$/.test(value.currency) &&
    value.ratesPct && typeof value.ratesPct === "object" &&
    typeof value.primaryDefect === "string";
}

function isLeverRiskProfile(value) {
  return value && typeof value === "object" && isRiskResult(value.risk);
}

export function getDisplayableProductionAmounts(value) {
  if (isRiskResult(value)) {
    return [amount("scrapCost", value.scrapCost, value.currency)];
  }

  if (value && isLeverRiskProfile(value.baseline) &&
      isLeverRiskProfile(value.best) && value.savings &&
      Number.isFinite(value.savings.inr)) {
    return [
      amount("baseline.risk.scrapCost", value.baseline.risk.scrapCost, value.baseline.risk.currency),
      amount("best.risk.scrapCost", value.best.risk.scrapCost, value.best.risk.currency),
      amount("savings.inr", value.savings.inr, "INR"),
    ];
  }

  if (value && isLeverRiskProfile(value.baseline) &&
      isLeverRiskProfile(value.recommended) && value.savings &&
      Number.isFinite(value.savings.inr)) {
    return [
      amount("baseline.risk.scrapCost", value.baseline.risk.scrapCost, value.baseline.risk.currency),
      amount("recommended.risk.scrapCost", value.recommended.risk.scrapCost, value.recommended.risk.currency),
      amount("savings.inr", value.savings.inr, "INR"),
    ];
  }

  return [];
}
