import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const {build} = createRequire(new URL('../../api-server/package.json', import.meta.url))('esbuild');
import { mkdtemp, rm } from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function load(relative) {
 const dir=await mkdtemp(path.join(tmpdir(),'swim-personal-test-'));
 const outfile=path.join(dir,'module.mjs');
 await build({entryPoints:[path.join(root,relative)],bundle:true,platform:'node',format:'esm',outfile});
 try {return await import(pathToFileURL(outfile).href)} finally {await rm(dir,{recursive:true,force:true})}
}
test('administrator resumes allowed personal deep paths; ordinary users cannot resume administration or external paths', async()=>{
 for(const relative of ['src/lib/return-path.ts','../api-server/src/lib/return-path.ts']){
  const {postLoginDestination,loginHref}=await load(relative);
  for(const personal of ['/','/daily?date=2026-01-01','/goals','/story/edit?question=1','/story/history','/story/history/own-version','/timeline?view=calendar']) assert.equal(postLoginDestination('ADMIN',personal),personal);
  assert.equal(postLoginDestination('ADMIN','/admin/users'),'/admin/users');
  assert.equal(postLoginDestination('USER','/admin/users'),'/');
  for(const path of ['https://example.com','//example.com','/admin/users%2fother','/admin/login','/not-allowed','/\\example.com','/daily\n']) assert.equal(postLoginDestination('ADMIN',path),'/admin/users');
  assert.equal(loginHref('/daily?date=2026-01-01','user'),'/login?next=%2Fdaily%3Fdate%3D2026-01-01');
 }
});
test('story response parsing keeps member identity and explicit capability, rejects ADMIN subject, and supports older USER responses',async()=>{
 const {parseStoryReadResponse}=await load('src/lib/story-read-response.ts');
 const user={id:'own-member',role:'USER',canSwitchToAdmin:true,displayName:'本人',membershipStatus:'ACTIVE'};
 for(const story of [null,{version:1,answers:[{questionNo:1,answerText:'本人の回答'}]}]){
  const parsed=parseStoryReadResponse({user,story});
  assert.equal(parsed.user.id,'own-member');assert.equal(parsed.user.role,'USER');assert.equal(parsed.user.canSwitchToAdmin,true);
 }
 assert.equal(parseStoryReadResponse({user:{...user,role:'SUPERUSER'},story:null}),null);
 assert.equal(parseStoryReadResponse({user:{...user,role:'ADMIN'},story:null}),null);
 assert.equal(parseStoryReadResponse({user:{...user,canSwitchToAdmin:'true'},story:null}),null);
 const {role,canSwitchToAdmin,...legacy}=user;
 assert.equal(parseStoryReadResponse({user:legacy,story:null}).user.role,'USER');
});
