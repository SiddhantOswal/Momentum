import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('final acceptance commands parse and keep live model calls behind explicit D4/private-release preconditions',()=>{
 const text=readFileSync(new URL('../docs/FINAL_PO_TO_CARD_ACCEPTANCE.md',import.meta.url),'utf8');
 const code=[...text.matchAll(/```js\n([\s\S]*?)\n```/g)].map(m=>m[1]).join('\n');
 assert.ok(code.length>1000);execFileSync(process.execPath,['--input-type=module','--check'],{input:code});
 assert.ok(code.indexOf("'D4 BLOCKED: STOP; no model-dependent call'")<code.indexOf("api('/orders/extract'"));
 assert.match(code,/completedStages\.includes\('optimizeLevers'\)/);assert.match(code,/authenticatedHuman===false/);assert.match(code,/Idempotency-Key/);assert.match(code,/Cross-session access accepted/);
 assert.match(text,/Not executed\. D4 is currently BLOCKED/);assert.match(text,/No default traffic switch or public IAM is included/);assert.match(text,/No automatic retry/i);
});
