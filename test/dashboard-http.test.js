import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';

test('dashboard static integration preserves APIs and enforces real signed-session/model boundaries',async()=>{
  const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
  const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
  const origin=`http://127.0.0.1:${port}`;
  // Minimal test-only environment: no credentials, provider adapters or cloud flags.
  const child=spawn(process.execPath,['index.mjs'],{cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,PORT:String(port),USTAAD_AUTHORIZATION_MODE:'HACKATHON_DEMO',USTAAD_DEMO_SESSION_SIGNING_KEY:'a'.repeat(64),USTAAD_ENABLE_APPROVAL_AUDIT:'true',USTAAD_SYNTHETIC_ONLY:'true'},stdio:['ignore','pipe','pipe']});
  try {
    await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('Server exited');}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Startup timed out')),6000).unref())]);
    const dashboard=await fetch(origin+'/dashboard?mock=1');assert.equal(dashboard.status,200);assert.equal(new URL(dashboard.url).pathname,'/');
    const html=await dashboard.text();assert.match(html,/guided-dashboard/);assert.doesNotMatch(html,/js\/mock\.js|mockbar/);
    const root=await(await fetch(origin+'/')).text();assert.match(root,/guided-dashboard/);assert.doesNotMatch(root,/workspace-switch|Open standard workspace/);
    for(const path of ['/dashboard.css','/ui/dashboard.js','/ui/workflow.js','/vendor/chart.umd.js','/fonts/plex-regular.woff2'])assert.equal((await fetch(origin+path)).status,200,path);
    for(const path of ['/ui/mock.js','/js/mock.js','/dashboard/.env'])assert.equal((await fetch(origin+path)).status,404,path);
    const redirect=await fetch(origin+'/dashboard/?check=1',{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/?check=1');
    const typo=await fetch(origin+'/dasboard',{redirect:'manual'});assert.equal(typo.status,302);assert.equal(typo.headers.get('location'),'/');
    const session=await fetch(origin+'/api/auth/demo-session',{method:'POST',headers:{Origin:origin}});assert.equal(session.status,200);
    const cookie=session.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
    const sid=JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0],'base64url').toString()).sid;
    const jobId=`JOB-HACK-${sid}-${'b'.repeat(40)}`;
    const url=origin+`/jobs/${jobId}/approve`;
    assert.equal((await fetch(url,{method:'POST',headers:{Origin:origin}})).status,401);
    const gated=await fetch(url,{method:'POST',headers:{Origin:origin,Cookie:cookie.split(';')[0]}});
    assert.equal(gated.status,503);assert.equal((await gated.json()).error.code,'SERVICE_UNAVAILABLE');
    assert.equal((await fetch(origin+'/health')).status,200);
  }finally {if(child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}}
});
