import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const moduleFile=new URL('../tools/prepare-release-snapshot.py',import.meta.url).pathname;
test('runtime snapshots are deterministic, include guided assets and omit unrelated credentials',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ustaad-snapshot-test-'));
 try{const result=JSON.parse(execFileSync('python3',['-c',`
import importlib.util, pathlib, json, sys
s=importlib.util.spec_from_file_location('release_snapshot',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
r=pathlib.Path(sys.argv[2])/'source';r.mkdir()
for name in m.ROOT_FILES+['config/'+n for n in m.CONFIG_FILES]+['ops/cloudbuild-private.yaml','src/ui/dashboard.js','public/dashboard.css']:
 p=r/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('SAFE TEST ONLY')
(r/'.env').write_text('SECRET=excluded');(r/'docs').mkdir();(r/'docs/private.txt').write_text('excluded')
a=m.prepare_snapshot(r,pathlib.Path(sys.argv[2])/'a','TEST-HEAD');b=m.prepare_snapshot(r,pathlib.Path(sys.argv[2])/'b','TEST-HEAD')
try:m.prepare_snapshot(r,pathlib.Path(sys.argv[2])/'a','TEST-HEAD');overwritten=True
except ValueError:overwritten=False
(r/'src/.env').write_text('NESTED_SECRET=not-an-actual-secret')
try:m.prepare_snapshot(r,pathlib.Path(sys.argv[2])/'secret','TEST-HEAD');secretRejected=False
except ValueError:secretRejected=True
(r/'src/.env').unlink();(r/'src/link.js').symlink_to(r/'index.mjs')
try:m.prepare_snapshot(r,pathlib.Path(sys.argv[2])/'symlink','TEST-HEAD');symlinkRejected=False
except ValueError:symlinkRejected=True
print(json.dumps({'sameArchive':a['archiveSha256']==b['archiveSha256'],'files':list(a['files']),'overwritten':overwritten,'secretRejected':secretRejected,'symlinkRejected':symlinkRejected}))
`,moduleFile,dir],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
 assert.equal(result.sameArchive,true);assert.equal(result.overwritten,false);assert.equal(result.secretRejected,true);assert.equal(result.symlinkRejected,true);assert.ok(result.files.includes('src/ui/dashboard.js'));assert.ok(result.files.includes('public/dashboard.css'));assert.ok(!result.files.some(x=>x.includes('.env')||x.startsWith('docs/')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
