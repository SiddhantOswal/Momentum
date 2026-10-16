import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../config/model-acceptance.json', import.meta.url), 'utf8'));
const guide = readFileSync(new URL('../docs/README.md', import.meta.url), 'utf8');

test('model acceptance remains explicit and its evidence limitations are documented for repository users', () => {
  assert.equal(config.status, 'accepted');
  assert.equal(config.ownerDecision.decision, 'ACCEPT_UNRECOVERABLE_INTERNAL_SPLIT_COUNT');
  assert.deepEqual(config.requiredR2, {WARP: 0.6, DELAM: 0.6, STRENGTH: 0.45, PRINT: 0.6, CRACK: 0.3});
  assert.equal(config.ownerDecision.supplementaryEvaluation.sampleCount, 219);
  assert.equal(config.ownerDecision.supplementaryEvaluation.r2.CRACK, -0.013623408295655226);
  assert.match(guide, /original internal-split sample counts and exact membership being unrecoverable/i);
  assert.match(guide, /supervised demonstration/i);
  assert.match(guide, /CRACK.*low confidence in monsoon/i);
  assert.match(guide, /not measured factory outcomes/i);
});
