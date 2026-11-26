// Stands in for the backend in the New Lot browser specs. These responses are test fixtures: they show
// that the page sends the right requests and handles each answer. They are not evidence that the
// real routes work.
export const FINGERPRINT = 'c'.repeat(64);

const levers = (overrides = {}) => ({ sfSpeedMpm: 40, rollTempC: 162, gumApplication: 'HIGH', gumViscositySec: 32, pastingPressure: 'MED', dryingHours: 8, printSpeedSpm: 50, ...overrides });
const risk = (kg, cost) => ({ ratesPct: { WARP: 2.1, DELAM: 1.2, STRENGTH: 1.4, PRINT: 0.9, CRACK: 0.1 }, totalScrapPct: 3, totalScrapKg: kg, scrapCost: cost, currency: 'INR', primaryDefect: 'WARP' });

export function jobResult({ explanation = 'Roll temperature and gum settings lower the warp rate for this board.', status = 'DRAFT' } = {}) {
  return {
    ok: true,
    jobSheet: {
      jobId: 'JOB-TEST-1', status,
      order: { orderId: 'TEST-CLA/PO/2026/1047', itemCode: 'PKBX0041', quantity: 1300 },
      conditions: { runDate: '2026-11-26', shift: 'DAY', ambientRhPct: 42, ambientTempC: 18.5, paperMoisturePct: 7.3 },
      baseline: { levers: levers(), risk: risk(100.4, 5351) },
      recommended: { levers: levers({ rollTempC: 170, gumApplication: 'MED', gumViscositySec: 35 }), risk: risk(83, 4426) },
      changes: [
        { lever: 'rollTempC', from: 162, to: 170 },
        { lever: 'gumApplication', from: 'HIGH', to: 'MED' },
        { lever: 'gumViscositySec', from: 32, to: 35 },
      ],
      savings: { kg: 17.4, inr: 925 },
      ...(explanation ? { explanation } : {}),
    },
    revision: { lotId: 'LOT-TEST-1', number: 1, fingerprint: FINGERPRINT, status: 'CURRENT' },
    runId: 'RUN-TEST-1',
  };
}

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export async function mockNewLot(page, { explanation, stale = false, failPlan = false, failExtract = false } = {}) {
  const seen = { extract: [], plan: [], approve: [], conditions: [] };
  await page.route('**/samples/*', (route) => route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 test' }));
  await page.route('**/orders/extract', async (route) => {
    seen.extract.push(route.request().postData());
    if (failExtract) return json(route, { ok: false, error: { message: 'The order could not be read.' } }, 422);
    return json(route, {
      ok: true, reviewId: 'REV-1', reviewFingerprint: 'a'.repeat(64),
      purchaseOrderDocument: { poNumber: 'TEST-CLA/PO/2026/1047', buyer: 'Client A' },
      lines: [{ lineIndex: 0, sourcePage: 1, extractedItemCode: 'PKBX0041', quantity: 1300, status: 'MATCHED' }],
    });
  });
  await page.route('**/conditions/current*', (route) => json(route, { ok: true, data: { runDate: '2026-11-26', shift: 'DAY', ambientRhPct: 42, ambientTempC: 18.5, paperMoisturePct: 7.3 }, sensorSource: 'dataset' }));
  await page.route('**/jobs', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    seen.plan.push({ body: route.request().postData(), key: route.request().headers()['idempotency-key'] });
    if (failPlan) return json(route, { ok: false, error: { message: 'Planning failed. Nothing was saved.' } }, 500);
    return json(route, jobResult({ explanation }));
  });
  await page.route('**/lots/LOT-TEST-1/conditions', async (route) => { seen.conditions.push(route.request().postDataJSON()); return json(route, { ok: true }); });
  await page.route('**/lots/LOT-TEST-1', (route) => json(route, {
    ok: true, lot: { lotId: 'LOT-TEST-1', currentRevision: stale ? 2 : 1 },
    revision: { number: 1, status: stale ? 'SUPERSEDED' : 'CURRENT', fingerprint: FINGERPRINT, supersededReason: { field: 'Paper moisture', source: 'Conditions', byRole: 'Supervisor session' } },
  }));
  await page.route('**/jobs/JOB-TEST-1/approve*', async (route) => {
    seen.approve.push(route.request().postDataJSON());
    return json(route, { ...jobResult({ explanation, status: 'APPROVED' }) });
  });
  return seen;
}

export async function reachConditions(page) {
  await page.goto('/app/#/new-lot');
  await page.getByRole('button', { name: 'PO1 Single line' }).click();
  await page.getByText('PKBX0041', { exact: true }).first().waitFor();
  for (const label of ['The source line is the one you want', 'The quantity matches the order', 'The catalog item is the right box']) await page.getByLabel(label).check();
  await page.getByRole('button', { name: 'Confirm order' }).click();
}

export async function fillSettings(page) {
  await page.getByLabel('Single facer speed').fill('40');
  await page.getByLabel('Roll temperature').fill('162');
  await page.getByLabel('Gum application').selectOption('HIGH');
  await page.getByLabel('Gum viscosity').fill('32');
  await page.getByLabel('Pasting pressure').selectOption('MED');
  await page.getByLabel('Drying time').fill('8');
  await page.getByLabel('Print speed').fill('50');
}
