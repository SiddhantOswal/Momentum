import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
before(async () => {
  vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, ws: false, watch: null } });
});
after(async () => vite?.close());
const load = () => vite.ssrLoadModule('/src/pages/prep-flow/model.ts');
const fixtures = () => vite.ssrLoadModule('/test/prep-flow-fixtures.ts');

const marks = (flow) => flow.steps.map((step) => step.mark);

test('normal: steps 1 to 6 are done and step 7 waits on a person', async () => {
  const { buildFlow } = await load();
  const { NORMAL } = await fixtures();
  const flow = buildFlow(NORMAL);
  assert.deepEqual(marks(flow), ['done', 'done', 'done', 'done', 'done', 'done', 'needs', 'idle', 'idle']);
  assert.deepEqual(flow.zones.map((zone) => zone.label), ['Complete', 'Complete', 'Waiting on you']);
  assert.equal(flow.hero[1].value, 'Review plan');
  assert.equal(flow.hero[1].note, 'Step 7 of 9, Decision zone');
  assert.equal(flow.edges[5].tone, 'needs');
  assert.equal(flow.toast, undefined);
});

test('held: only step 1 is done and step 2 is held, with nothing after it run', async () => {
  const { buildFlow } = await load();
  const { HELD } = await fixtures();
  const flow = buildFlow(HELD);
  assert.deepEqual(marks(flow), ['done', 'held', 'idle', 'idle', 'idle', 'idle', 'idle', 'idle', 'idle']);
  assert.deepEqual(flow.zones.map((zone) => zone.label), ['Held', 'Not reached', 'Not reached']);
  assert.equal(flow.edges[1].tone, 'held');
  assert.equal(flow.toast.title, 'Order is unclear');
  assert.equal(flow.steps[3].text, 'Waits for the earlier steps');
});

test('partial: the numbers stand, risk evidence failed and the decision zone is blocked', async () => {
  const { buildFlow } = await load();
  const { PARTIAL } = await fixtures();
  const flow = buildFlow(PARTIAL);
  assert.deepEqual(marks(flow), ['done', 'done', 'done', 'done', 'done', 'attention', 'idle', 'idle', 'idle']);
  assert.deepEqual(flow.zones.map((zone) => zone.label), ['Complete', 'Partly done', 'Blocked']);
  assert.equal(flow.edges[5].tone, 'attention');
  assert.equal(flow.steps[6].text, 'Waiting on evidence');
  assert.equal(flow.toast.tone, 'bad');
});

test('the retired trade-off figure and pass-level claim are never produced', async () => {
  const { buildFlow } = await load();
  const { NORMAL, HELD, PARTIAL } = await fixtures();
  for (const input of [NORMAL, HELD, PARTIAL]) {
    const text = JSON.stringify(buildFlow(input));
    for (const retired of ['0.078', 'Only Print', 'pass level']) assert.ok(!text.includes(retired), retired);
  }
});

test('search and change counts appear only when the source supplies them', async () => {
  const { buildFlow } = await load();
  const { NORMAL } = await fixtures();
  assert.equal(buildFlow(NORMAL).steps[4].text, '8,640 tries, 3 changes max');
  const bare = buildFlow({ ...NORMAL, candidateCount: undefined, changeCount: undefined });
  assert.equal(bare.steps[4].text, '3 changes max');
  assert.equal(bare.panel.decisions[0], "Do the changes make sense for today's floor?");
  assert.equal(buildFlow(NORMAL).panel.decisions[0], "Do the three changes make sense for today's floor?");
});

test('only a planned lot can be drawn from the live store', async () => {
  const { flowFromLot } = await load();
  const lot = { lotId: 'LOT-1', orderId: 'O1', itemCode: 'PKBX0041', quantity: 1300, status: 'planned', updatedAt: '2026-11-26T10:00:00Z', changes: [{}, {}, {}] };
  const input = flowFromLot(lot);
  assert.equal(input.at, 7);
  assert.equal(input.lotNote, '1,300 boxes');
  assert.equal(input.changeCount, 3);
  for (const status of ['approved', 'running', 'done', 'blocked']) assert.equal(flowFromLot({ ...lot, status }), null, status);
});
