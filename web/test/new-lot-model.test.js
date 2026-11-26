import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
before(async () => {
  vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, ws: false, watch: null } });
});
after(async () => vite?.close());
const load = () => vite.ssrLoadModule('/src/pages/new-lot/model.ts');

const levers = { sfSpeedMpm: '40', rollTempC: '162', gumApplication: 'HIGH', gumViscositySec: '32', pastingPressure: 'MED', dryingHours: '8', printSpeedSpm: '50' };
const conditions = { ambientRhPct: '42', paperMoisturePct: '7.3', ambientTempC: '18.5', runDate: '2026-11-26', shift: 'DAY' };

test('twelve fields must be valid before planning, and out-of-range values do not count', async () => {
  const { fieldProgress, EMPTY_CONDITIONS, EMPTY_LEVERS } = await load();
  assert.deepEqual(fieldProgress(EMPTY_CONDITIONS, EMPTY_LEVERS), { done: 0, total: 12, left: 12 });
  assert.equal(fieldProgress(conditions, levers).left, 0);
  assert.equal(fieldProgress({ ...conditions, ambientRhPct: '140' }, levers).left, 1);
  assert.equal(fieldProgress(conditions, { ...levers, rollTempC: '300' }).left, 1);
  assert.equal(fieldProgress(conditions, { ...levers, gumApplication: 'EXTRA' }).left, 1);
});

test('a line cannot be prepared with an unknown code, a missing quantity or several catalog candidates', async () => {
  const { lineProblem } = await load();
  const line = { lineIndex: 0, extractedItemCode: 'PKBX0041', quantity: 1300, status: 'MATCHED' };
  assert.equal(lineProblem(line, { code: 'PKBX0041', quantity: '1300' }), undefined);
  assert.match(lineProblem(undefined, { code: '', quantity: '' }), /Select the order line/);
  assert.match(lineProblem(line, { code: 'PKBX0041', quantity: '' }), /quantity/);
  assert.match(lineProblem({ ...line, status: 'UNKNOWN_CODE' }, { code: 'PKBX0041', quantity: '5' }), /not in the plant's catalog/);
  assert.match(lineProblem({ ...line, candidates: ['A', 'B'] }, { code: 'PKBX0041', quantity: '5' }), /more than one/);
});

test('the plan body carries the review fingerprint, the operator choices and every setting', async () => {
  const { planBody, planFingerprint } = await load();
  const input = {
    file: new File(['x'], 'po.pdf', { type: 'application/pdf' }),
    context: { orderId: 'PO-1', paperType: 'RECYCLED', paperSupplier: 'SUP-D' },
    extraction: { reviewId: 'R1', reviewFingerprint: 'a'.repeat(64), lines: [] },
    lineIndex: 0, choice: { code: ' PKBX0041 ', quantity: '1300' }, conditions, levers, lotId: 'LOT-1',
  };
  const body = planBody(input);
  assert.equal(body.get('confirmedItemCode'), 'PKBX0041');
  assert.equal(body.get('confirmedLineIndex'), '1');
  assert.equal(body.get('reviewFingerprint'), 'a'.repeat(64));
  assert.equal(body.get('conditionsConfirmed'), 'true');
  assert.equal(body.get('lotId'), 'LOT-1');
  assert.equal(body.get('gumApplication'), 'HIGH');
  assert.notEqual(planFingerprint(input), planFingerprint({ ...input, levers: { ...levers, rollTempC: '170' } }));
});

test('conditions are saved as confirmed only for fields the operator touched', async () => {
  const { conditionPatch } = await load();
  const patch = conditionPatch(conditions, new Set(['paperMoisturePct']));
  assert.deepEqual(patch.find((entry) => entry.field === 'paperMoisturePct'), { field: 'paperMoisturePct', value: 7.3, source: 'confirmed' });
  assert.equal(patch.find((entry) => entry.field === 'ambientRhPct').source, 'typed');
  assert.equal(patch.find((entry) => entry.field === 'shift').value, 'DAY');
});

test('a revision is replaced when the lot says superseded or has moved on', async () => {
  const { isReplaced } = await load();
  const result = { jobSheet: {}, revision: { lotId: 'L', number: 1, fingerprint: 'f', status: 'CURRENT' } };
  assert.equal(isReplaced(undefined, result), false);
  assert.equal(isReplaced({ lot: { lotId: 'L', currentRevision: 1 }, revision: { number: 1, status: 'CURRENT', fingerprint: 'f' } }, result), false);
  assert.equal(isReplaced({ lot: { lotId: 'L', currentRevision: 1 }, revision: { number: 1, status: 'SUPERSEDED', fingerprint: 'f' } }, result), true);
  assert.equal(isReplaced({ lot: { lotId: 'L', currentRevision: 2 } }, result), true);
});
