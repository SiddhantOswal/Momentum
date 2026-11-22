// Only a Google sign-in names a person on the live floor view.
export const liveActor = (principal) => principal?.provider === "google.com" && typeof principal.email === "string" ? principal.email : undefined;

export function liveLot(jobSheet, status) {
  const risk = jobSheet?.recommended?.risk ?? jobSheet?.baseline?.risk;
  return {
    lotId: jobSheet?.jobId, jobId: jobSheet?.jobId, status,
    orderId: jobSheet?.order?.orderId, itemCode: jobSheet?.order?.itemCode, quantity: jobSheet?.order?.quantity,
    ...(risk ? { totalScrapPct: risk.totalScrapPct, primaryDefect: risk.primaryDefect, ratesPct: risk.ratesPct, currency: risk.currency } : {}),
    ...(Number.isFinite(jobSheet?.savings?.inr) ? { predictedSaving: Math.max(0, jobSheet.savings.inr) } : {}),
    ...(Array.isArray(jobSheet?.changes) ? { changes: jobSheet.changes.slice(0, 3).map(({ lever, from, to }) => ({ lever, from, to })) } : {}),
  };
}
