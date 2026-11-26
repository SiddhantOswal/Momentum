import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
before(async () => {
  vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, ws: false, watch: null } });
});
after(async () => vite?.close());

const load = () => vite.ssrLoadModule('/src/routes.ts');

test('the registry has the seven approved destinations in order', async () => {
  const { ROUTES } = await load();
  assert.deepEqual(ROUTES.map(route => route.label),
    ['Home', 'New Lot', 'Plant Explorer', 'Preparation Flow', 'Insights', 'Photo Diagnosis', 'Planning']);
  assert.equal(new Set(ROUTES.map(route => route.key)).size, ROUTES.length);
  assert.equal(new Set(ROUTES.map(route => route.path)).size, ROUTES.length);
  assert.deepEqual(ROUTES.filter(route => route.group === 'future').map(route => route.label), ['Planning']);
});

test('earlier names resolve to the new routes and are marked non-canonical', async () => {
  const { resolveRoute } = await load();
  for (const [hash, key] of [['#/lots', 'new-lot'], ['#/floor', 'home'], ['#/impact', 'insights'], ['#/models', 'insights'],
    ['#/defects', 'photo-diagnosis'], ['#screen-order-input', 'new-lot']]) {
    const { route, canonical } = resolveRoute(hash);
    assert.equal(route.key, key, hash);
    assert.equal(canonical, false, hash);
  }
});

test('canonical addresses, including nested paths, resolve directly', async () => {
  const { resolveRoute } = await load();
  assert.deepEqual([resolveRoute('#/new-lot/conditions').route.key, resolveRoute('#/new-lot/conditions').canonical], ['new-lot', true]);
  assert.equal(resolveRoute('#/insights?tab=impact').route.key, 'insights');
});

test('an empty or unknown address falls back to Home', async () => {
  const { resolveRoute } = await load();
  assert.equal(resolveRoute('').route.key, 'home');
  assert.equal(resolveRoute('#/nowhere').route.key, 'home');
});

test('no alias duplicates a sidebar label', async () => {
  const { ROUTES } = await load();
  for (const legacy of ['Floor', 'Lots', 'Defects', 'Impact', 'Models', 'Defect Check']) {
    assert.ok(!ROUTES.some(route => route.label === legacy), legacy);
  }
});
