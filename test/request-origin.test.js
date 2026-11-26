import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationOrigin, isSameApplicationOrigin, sessionOrigin } from '../src/request-origin.js';

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
test('the session audience is the origin the same-origin check accepts',()=>{
  assert.equal(applicationOrigin({requestUrl:'http://backend.internal/x',cloudRun:true,configuredOrigin:'https://momentum.example'}),'https://momentum.example');
  assert.equal(applicationOrigin({requestUrl:'http://candidate.run.app/x',cloudRun:true}),'https://candidate.run.app');
  assert.equal(applicationOrigin({requestUrl:'http://localhost:4100/x'}),'http://localhost:4100');
  assert.equal(applicationOrigin({requestUrl:'http://localhost:4100/x',configuredOrigin:'http://localhost:4100'}),'http://localhost:4100');
  for(const configuredOrigin of ['','https://momentum.example/','https://user@momentum.example','not a url'])assert.equal(applicationOrigin({requestUrl:'http://localhost:4100/x',configuredOrigin}),undefined,configuredOrigin);
  assert.equal(applicationOrigin({requestUrl:'http://x/y',cloudRun:true,configuredOrigin:'http://momentum.example'}),undefined);
  assert.equal(applicationOrigin({requestUrl:'not a url'}),undefined);
  assert.equal(applicationOrigin({requestUrl:'https://momentum-ai.example/x'}),undefined);
  assert.equal(isSameApplicationOrigin({requestUrl:'https://momentum-ai.example/x',origin:'https://momentum-ai.example'}),false);
  assert.equal(applicationOrigin({requestUrl:'http://x/y',configuredOrigin:'https://momentum.example'}),'https://momentum.example');
});
test('on Cloud Run the session origin is only ever the configured https origin, never the request host',()=>{
  assert.equal(sessionOrigin({requestUrl:'http://momentum-ai.example/x',cloudRun:true}),undefined);
  assert.equal(sessionOrigin({requestUrl:'https://attacker.example/x',cloudRun:true}),undefined);
  for(const configuredOrigin of ['','http://momentum.example','https://momentum.example/','not an origin'])assert.equal(sessionOrigin({requestUrl:'http://momentum.example/x',cloudRun:true,configuredOrigin}),undefined,configuredOrigin);
  assert.equal(sessionOrigin({requestUrl:'https://attacker.example/x',cloudRun:true,configuredOrigin:'https://momentum.example'}),'https://momentum.example');
  assert.equal(sessionOrigin({cloudRun:true,configuredOrigin:'https://momentum.example'}),'https://momentum.example');
  assert.equal(sessionOrigin({requestUrl:'http://localhost:4100/x'}),'http://localhost:4100');
  assert.equal(sessionOrigin({requestUrl:'https://momentum.example/x'}),undefined);
});
