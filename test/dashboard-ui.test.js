import test from 'node:test';
import assert from 'node:assert/strict';
import { homePage } from '../src/operator-ui.js';
import contract from './fixtures/dashboard-control-contract.json' with {type:'json'};
const dashboardPage = homePage;
import { MANUFACTURING_STAGES, LEVER_FIELDS } from '../src/ui/fields.js';

const attrs = (html, tag) => [...html.matchAll(new RegExp('<'+tag+'\\b[^>]*>', 'g'))].map(x=>x[0]).sort();
test('canonical dashboard preserves every pre-promotion field, form, ID and operational control', () => {
  for (const tag of ['input','select','textarea','form','button']) assert.deepEqual(attrs(dashboardPage,tag),contract.controls[tag],tag);
  const ids = html => [...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
  const original=contract.ids, guided=ids(dashboardPage);
  assert.equal(new Set(guided).size,guided.length);
  assert.deepEqual(guided.sort(),original.sort());
});
test('guided presentation adds the three-stage job view using the single shared controller', () => {
  assert.match(dashboardPage,/class="guided-dashboard"/);
  assert.match(dashboardPage,/src="\/ui\/dashboard.js"/);
  assert.match(dashboardPage,/href="\/dashboard.css"/);
  assert.match(dashboardPage,/id="dashboard-job-review" class="screen" data-screen-panel/);
  assert.match(dashboardPage,/<h1 id="screen-job-heading">Job card<\/h1>/);
  assert.equal((dashboardPage.match(/data-dashboard-stage=/g)??[]).length,3);
  assert.doesNotMatch(dashboardPage,/js\/mock\.js|js\/api\.js|iframe|fonts\.googleapis/);
  assert.doesNotMatch(homePage,/workspace-switch|Open standard workspace|workflow-strip/);
  assert.match(homePage,/href="#dashboard-job-review">Review job card/);
});
test('manufacturing display follows the canonical PDF stage order and only recorded lever keys', () => {
  assert.deepEqual(MANUFACTURING_STAGES.map(([title])=>title),['Printing (flexo, top liner)','Single facer','Sheet cutting','Pasting','Drying / conditioning','Cutting and creasing','Slotting','Stitching / gluing','QC and bundling']);
  const known=new Set(LEVER_FIELDS.map(([key])=>key));
  for(const [,keys] of MANUFACTURING_STAGES) for(const key of keys) assert.ok(known.has(key),key);
});
