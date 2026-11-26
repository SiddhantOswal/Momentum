import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
before(async () => {
  vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, ws: false, watch: null } });
});
after(async () => vite?.close());
const load = () => vite.ssrLoadModule('/src/pages/photo-diagnosis/model.ts');

const photos = (count) => ({ ok: true, photos: Array.from({ length: count }, (_, i) => ({ id: `photo-${String(i + 1).padStart(2, '0')}`, label: `Approved photo ${i + 1}` })) });

test('the approved set is accepted only when it holds exactly ten well-formed photos', async () => {
  const { readApprovedPhotos } = await load();
  assert.equal(readApprovedPhotos(photos(10)).length, 10);
  assert.equal(readApprovedPhotos(photos(9)), null);
  assert.equal(readApprovedPhotos(photos(11)), null);
  assert.equal(readApprovedPhotos({ photos: [...photos(9).photos, { id: 'x', label: 'Approved photo 10' }] }), null);
  assert.equal(readApprovedPhotos(undefined), null);
});

test('a classification must be a Gemini result for the photo asked about with a known label', async () => {
  const { readClassification } = await load();
  const good = { source: 'vertex-gemini', photoId: 'photo-01', label: 'DELAM', classifiedAt: '2026-10-15T00:00:00Z' };
  assert.equal(readClassification(good, 'photo-01').label, 'DELAM');
  assert.equal(readClassification(good, 'photo-02'), null);
  assert.equal(readClassification({ ...good, source: 'mock-demo' }, 'photo-01'), null);
  assert.equal(readClassification({ ...good, label: '<img src=x onerror=alert(1)>' }, 'photo-01'), null);
});

test('labels read as names and an unknown label is not guessed', async () => {
  const { defectName } = await load();
  assert.equal(defectName('NONE'), 'No visible defect');
  assert.equal(defectName('DELAM'), 'Delamination');
  assert.equal(defectName('???'), 'Not recorded');
});
