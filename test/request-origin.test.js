import test from 'node:test';
import assert from 'node:assert/strict';
import { isSameApplicationOrigin } from '../src/request-origin.js';

test('managed TLS termination accepts the exact configured HTTPS origin without trusting proxy headers',()=>{
  const config={requestUrl:'http://backend.internal/api/auth/demo-session',cloudRun:true,configuredOrigin:'https://private-candidate.run.app'};
  assert.equal(isSameApplicationOrigin({...config,origin:'https://private-candidate.run.app'}),true);
  for(const origin of [undefined,'null','http://private-candidate.run.app','https://evil.run.app','https://private-candidate.run.app/','https://user@private-candidate.run.app','https://private-candidate.run.app.evil.test'])assert.equal(isSameApplicationOrigin({...config,origin}),false);
  assert.equal(isSameApplicationOrigin({...config,origin:'https://private-candidate.run.app',configuredOrigin:'http://private-candidate.run.app'}),false);
});
test('local same-origin policy remains exact and Cloud Run fallback restores HTTPS only',()=>{
  assert.equal(isSameApplicationOrigin({requestUrl:'http://localhost:4100/path',origin:'http://localhost:4100'}),true);
  assert.equal(isSameApplicationOrigin({requestUrl:'http://localhost:4100/path',origin:'http://localhost:4101'}),false);
  assert.equal(isSameApplicationOrigin({requestUrl:'http://candidate.run.app/path',origin:'https://candidate.run.app',cloudRun:true}),true);
  assert.equal(isSameApplicationOrigin({requestUrl:'http://candidate.run.app/path',origin:'http://candidate.run.app',cloudRun:true}),false);
});
