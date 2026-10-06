import assert from 'node:assert/strict';
import {test, before, after} from 'node:test';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import pg from 'pg';

const dbUrl=new URL(process.env.TEST_DATABASE_URL);
assert.ok(['127.0.0.1','localhost'].includes(dbUrl.hostname));
assert.equal(dbUrl.pathname,'/admin_personal_synthetic');
process.env.DATABASE_URL=dbUrl.href;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let dir, modules, pool;
const admin='fixture-admin',member='fixture-member';
function pair(){process.env.ADMIN_PERSONAL_ADMIN_USER_ID=admin;process.env.ADMIN_PERSONAL_MEMBER_USER_ID=member;}
async function access(token){
 return modules.runWithRequestContext({cookies:{swim_story_session:token}}, {}, ()=>modules.authorizePersonalRequest());
}
async function writeContext(){pair();const token=await modules.createSession(admin);const result=await access(token);assert.ok(result.access);return result.access.writeContext;}
const input=()=>({userId:member,logDate:new Date('2026-01-02T00:00:00Z'),baseRevision:null,score:6,activityType:'PRACTICE',goodText:'race',improveText:null,tomorrowText:null});
async function waitBlocked(pattern){
 const until=Date.now()+4000;
 while(Date.now()<until){const rows=await pool.query("select query from pg_stat_activity where datname=current_database() and wait_event_type='Lock'");if(rows.rows.some(r=>r.query.includes(pattern)))return;await new Promise(resolve=>setTimeout(resolve,20));}
 throw new Error(`No blocked PostgreSQL transaction for ${pattern}`);
}
before(async()=>{
 dir=await mkdtemp(path.join(root,'tests/.pair-runtime-'));
 const outfile=path.join(dir,'module.mjs');
 await build({stdin:{contents:`export * from '${root}/src/lib/personal-access.ts';export * from '${root}/src/lib/auth.ts';export * from '${root}/src/lib/express-compat.ts';export * from '${root}/src/lib/daily-log-service.ts';export * from '${root}/src/lib/member-access.ts';export {prisma} from '${root}/src/lib/prisma.ts';`,resolveDir:root},bundle:true,packages:'external',platform:'node',format:'esm',outfile});
 modules=await import(pathToFileURL(outfile).href);
 pool=new pg.Pool({connectionString:dbUrl.href,max:6});
 assert.equal((await pool.query('select count(*)::int as count from users')).rows[0].count,3);
 await pool.query("delete from daily_logs where user_id='fixture-member' and log_date='2026-01-02'");
 await pool.query("update users set is_active=true,role='USER',membership_status='ACTIVE',withdrawn_at=null where id='fixture-member'");
 await pool.query("update users set is_active=true,role='ADMIN' where id='fixture-admin'");
});
after(async()=>{await modules?.prisma.$disconnect();await pool?.end();if(dir)await rm(dir,{recursive:true,force:true});});

test('pair is disabled unless both exact immutable ids match active ADMIN and USER; USER never gains admin capability',async()=>{
 const token=await modules.createSession(admin);
 const scenarios=[{}, {ADMIN_PERSONAL_ADMIN_USER_ID:admin}, {ADMIN_PERSONAL_ADMIN_USER_ID:admin,ADMIN_PERSONAL_MEMBER_USER_ID:admin}, {ADMIN_PERSONAL_ADMIN_USER_ID:'wrong',ADMIN_PERSONAL_MEMBER_USER_ID:member}, {ADMIN_PERSONAL_ADMIN_USER_ID:admin,ADMIN_PERSONAL_MEMBER_USER_ID:'missing'}];
 for(const env of scenarios){delete process.env.ADMIN_PERSONAL_ADMIN_USER_ID;delete process.env.ADMIN_PERSONAL_MEMBER_USER_ID;Object.assign(process.env,env);const result=await access(token);assert.equal(result.response.status,403);assert.equal(result.response.body.code,'PERSONAL_ACCESS_UNAVAILABLE');}
 pair();const result=await access(token);assert.equal(result.access.actor.id,admin);assert.equal(result.access.subject.id,member);assert.equal(result.access.subject.role,'USER');assert.equal(result.access.canSwitchToAdmin,true);
 const own=await access(await modules.createSession(member));assert.equal(own.access.subject.id,member);assert.equal(own.access.actor.id,member);assert.equal(own.access.canSwitchToAdmin,false);
});

test('revocation, expiry, actor/subject role/active and withdrawal committed before the lock prevent saving',async()=>{
 const changes=[
  ["delete from sessions where id=$1",c=>[c.sessionId],'AUTH_REQUIRED',null],
  ["update sessions set expires_at=timestamp '2000-01-01' where id=$1",c=>[c.sessionId],'AUTH_REQUIRED',null],
  ["update users set is_active=false where id=$1",c=>[c.actorId],'AUTH_REQUIRED',"update users set is_active=true where id='fixture-admin'"],
  ["update users set role='USER' where id=$1",c=>[c.actorId],'PERSONAL_ACCESS_UNAVAILABLE',"update users set role='ADMIN' where id='fixture-admin'"],
  ["update users set is_active=false where id=$1",c=>[c.subjectId],'PERSONAL_ACCESS_UNAVAILABLE',"update users set is_active=true where id='fixture-member'"],
  ["update users set role='ADMIN' where id=$1",c=>[c.subjectId],'PERSONAL_ACCESS_UNAVAILABLE',"update users set role='USER' where id='fixture-member'"],
  ["update users set membership_status='WITHDRAWN',withdrawn_at=now() where id=$1",c=>[c.subjectId],null,"update users set membership_status='ACTIVE',withdrawn_at=null where id='fixture-member'"],
 ];
 for(const [sql,params,code,restore] of changes){

  const context=await writeContext();const blocker=await pool.connect();await blocker.query('begin');
  await blocker.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`member-write:${member}`]);
  const saving=modules.saveDailyLog(input(),context);const outcome=saving.then(()=>({success:true}),error=>({error}));
  try { await waitBlocked('pg_advisory_xact_lock');await pool.query(sql,params(context)); } catch(error) { await blocker.query('rollback');await outcome;throw error; } finally { await blocker.query('commit');blocker.release(); }
  const {error,success}=await outcome;assert.ok(!success,sql);assert.ok(error,sql);
  if(code)assert.equal(error.code,code,sql);else assert.ok(error instanceof modules.MembershipWriteBlockedError);
  assert.equal((await pool.query("select count(*)::int as count from daily_logs where user_id=$1 and log_date='2026-01-02'",[member])).rows[0].count,0);
  if(restore)await pool.query(restore);
 }
 const context=await writeContext();delete process.env.ADMIN_PERSONAL_MEMBER_USER_ID;
 await assert.rejects(modules.saveDailyLog(input(),context),error=>error.code==='PERSONAL_ACCESS_UNAVAILABLE');pair();
});

test('save holding user/session rows commits before competing deactivation or session deletion',async()=>{
 await pool.query(`create function fixture_pause_daily() returns trigger language plpgsql as $$ begin if NEW.good_text='race-save-first' then perform pg_advisory_xact_lock(hashtextextended('fixture-save-first',0)); end if; return NEW; end $$`);
 await pool.query('create trigger fixture_pause before insert on daily_logs for each row execute function fixture_pause_daily()');
 try{
  for(const mutation of ['user','session']){

   const context=await writeContext();const blocker=await pool.connect();let saving,invalidating;
   try {
    await blocker.query('begin');await blocker.query("select pg_advisory_xact_lock(hashtextextended('fixture-save-first',0))");
    saving=modules.saveDailyLog({...input(),goodText:'race-save-first'},context);saving.catch(()=>{});
    await waitBlocked('INSERT INTO');
    let changed=false;invalidating=pool.query(mutation==='user'?'update users set is_active=false where id=$1':'delete from sessions where id=$1',[mutation==='user'?member:context.sessionId]).then(()=>{changed=true});invalidating.catch(()=>{});
    await waitBlocked(mutation==='user'?'update users':'delete from sessions');assert.equal(changed,false);
    await blocker.query('commit');assert.equal((await saving).revision,1);await invalidating;assert.equal(changed,true);
    assert.equal((await pool.query("select good_text from daily_logs where user_id=$1 and log_date='2026-01-02'",[member])).rows[0].good_text,'race-save-first');
   } finally {
    await blocker.query('rollback');blocker.release();
    await Promise.allSettled([saving,invalidating].filter(Boolean));
    await pool.query("delete from daily_logs where user_id=$1 and log_date='2026-01-02'",[member]);
    await pool.query("update users set is_active=true where id=$1",[member]);
   }
  }
 }finally{await pool.query('drop trigger fixture_pause on daily_logs');await pool.query('drop function fixture_pause_daily()');}
});
