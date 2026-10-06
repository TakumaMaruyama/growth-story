import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const requireApi=createRequire(new URL('../../api-server/package.json',import.meta.url));
const pg=requireApi('pg'),bcrypt=requireApi('bcrypt');
assert.ok(process.env.PLAYWRIGHT_MODULE_PATH && process.env.TEST_API_BASE_URL && process.env.TEST_DATABASE_URL,'Explicit local synthetic endpoints and Playwright module are required');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const baseUrl=new URL(process.env.TEST_API_BASE_URL);
const databaseUrl=new URL(process.env.TEST_DATABASE_URL);
assert.ok(['localhost','127.0.0.1'].includes(baseUrl.hostname));
assert.ok(['localhost','127.0.0.1'].includes(databaseUrl.hostname));
assert.equal(databaseUrl.pathname,'/nav_bug_synthetic');
const base=baseUrl.origin;
const pool=new pg.Pool({connectionString:databaseUrl.href});
const baseline=process.env.NAV_BUG_EXPECT_BASELINE==='1';
const stage=baseline?'before':'after';
const output=path.resolve(process.env.TEST_SCREENSHOTS_DIR ?? '/tmp/nav-bug-screenshots',stage);
const password='Synthetic-nav-only-2026!';
let browser;
const diagnostic=[];
const log=(item)=>{diagnostic.push(item);console.log(JSON.stringify(item));};
before(async()=>{
 await mkdir(output,{recursive:true});
 if(process.env.NAV_BUG_SEED==='1'){
  assert.equal((await pool.query('select count(*)::int as count from users')).rows[0].count,0);
  const hash=await bcrypt.hash(password,12);
  await pool.query('begin');
  try {
  for(const [id,role] of [['bug-empty','USER'],['bug-seeded','USER'],['bug-boundary','USER'],['bug-withdrawn','USER'],['bug-other','USER'],['bug-admin','ADMIN']]){
   await pool.query('insert into users(id,login_id,display_name,password_hash,role,updated_at) values($1,$1,$1,$2,$3,now())',[id,hash,role]);
  }
  await pool.query("update users set membership_status='WITHDRAWN',withdrawn_at=now() where id='bug-withdrawn'");
  for(const user of ['bug-seeded','bug-boundary','bug-withdrawn','bug-other']){
   await pool.query("insert into story_versions(id,user_id,version,note,created_at) values($1,$2,1,'synthetic record',timestamp '2026-10-01 15:30:00')",[user+'-story',user]);
   await pool.query('insert into story_answers(id,story_version_id,question_no,answer_text) values($1,$2,2,$3),($4,$2,1,$5)',[user+'-answer-2',user+'-story',user==='bug-boundary'?'泳'.repeat(4000):'二番目の回答',user+'-answer-1','一番目の回答\n改行と🏊']);
   await pool.query("insert into daily_logs(id,user_id,log_date,score,good_text,updated_at) values($1,$2,'2026-10-02',8,'synthetic-only',now())",[user+'-daily',user]);
   await pool.query("insert into competition_goals(id,user_id,goal_type,title,target_date,updated_at) values($1,$2,'NEXT_MEET','synthetic goal',null,now())",[user+'-goal',user]);
  }
  await pool.query('commit');
  } catch(error) {await pool.query('rollback');throw error;}
 }
 assert.deepEqual((await pool.query('select id from users order by id')).rows.map(row=>row.id),['bug-admin','bug-boundary','bug-empty','bug-other','bug-seeded','bug-withdrawn']);
 await pool.query('delete from rate_limit_events');
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
});
after(async()=>{await writeFile(path.join(output,'console-errors.json'),JSON.stringify(diagnostic,null,2));await browser?.close();await pool.end();});
async function login(loginId,viewport={width:390,height:844}){
 const context=await browser.newContext({viewport});
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const page=await context.newPage();
 page.on('console',async message=>{
  if(message.type()!=='error'||!message.text().includes('ErrorBoundary caught'))return;
  const args=message.args();
  const error=await args[1].evaluate(value=>({name:value.name,message:value.message,stack:value.stack}));
  const componentStack=await args[2].jsonValue();log({loginId,url:page.url(),error,componentStack});
 });
 await page.goto(base+'/login');
 await page.getByLabel('ログインID',{exact:true}).fill(loginId);await page.getByLabel('パスワード',{exact:true}).fill(password);
 await page.getByRole('button',{name:'ログイン',exact:true}).click();await page.waitForURL(url=>!url.pathname.includes('login'));
 return {page,context};
}
async function api(page,url){const result=await page.request.get(base+url);return{status:result.status(),body:await result.json()};}
async function expected(page,crash){
 if(crash)await page.getByRole('heading',{name:'Something went wrong',exact:true}).waitFor();
 else {await page.locator('main').waitFor();assert.equal(await page.getByRole('heading',{name:'Something went wrong',exact:true}).count(),0);}
}
for(const user of ['bug-empty','bug-seeded'])test(`${stage}: ${user} mobile bottom navigation Story/Timeline`,async()=>{
 const {page,context}=await login(user);
 try{
  await page.locator('.mobile-bottom-nav').getByRole('link',{name:'競泳物語',exact:true}).click();
  const story=await api(page,'/api/story');assert.equal(story.status,200);
  if(baseline&&user==='bug-seeded'){
   assert.equal(story.body.story.content,undefined);assert.equal(story.body.story.createdAt,undefined);assert.equal(story.body.isReadOnly,undefined);
   log({loginId:user,api:'/api/story',storyFields:Object.keys(story.body.story),isReadOnlyPresent:'isReadOnly' in story.body});
  }
  await expected(page,baseline&&user==='bug-seeded');
  if(!baseline&&user==='bug-seeded')await page.getByText('一番目の回答',{exact:true}).waitFor();
  await page.screenshot({path:path.join(output,user+'-story.png')});
  await page.goto(base+'/');await page.locator('.mobile-bottom-nav').getByRole('link',{name:'記録',exact:true}).click();
  assert.equal((await api(page,'/api/timeline')).status,200);
  await expected(page,baseline);
  if(!baseline)await page.getByRole('link',{name:'今月',exact:true}).waitFor();
  await page.screenshot({path:path.join(output,user+'-timeline.png')});
 }finally{await context.close();}
});

if(!baseline){
 test('after: Story DTO preserves answers, current version, long content and withdrawn read-only state; ownership/auth stay unchanged',async()=>{
  for(const user of ['bug-empty','bug-seeded','bug-boundary','bug-withdrawn']){
   const {page,context}=await login(user,{width:1280,height:900});
   try{
    const result=await api(page,'/api/story?userId=bug-other');assert.equal(result.status,200);assert.equal(result.body.user.id,user);
    assert.equal(result.body.isReadOnly,user==='bug-withdrawn');
    if(user==='bug-empty')assert.equal(result.body.story,null);
    else {
     assert.ok(Number.isFinite(Date.parse(result.body.story.createdAt)));
     assert.deepEqual(result.body.story.answers.map(answer=>answer.questionNo),[1,2]);
     assert.equal(result.body.story.content,result.body.story.answers.map(answer=>answer.answerText).join('\n\n'));
     if(user==='bug-boundary')assert.equal(result.body.story.answers[1].answerText.length,4000);
    }
    assert.equal((await api(page,'/api/story/history/bug-other-story')).status,404);
    assert.equal((await api(page,'/api/admin/users')).status,403);
    await page.goto(base+'/story');
    if(user==='bug-empty')await page.getByText('まだ物語は書かれていません。',{exact:true}).waitFor();
    else await page.getByText('一番目の回答',{exact:true}).waitFor();
    await expected(page,false);
    if(user==='bug-withdrawn'){
     assert.equal(await page.getByRole('link',{name:'物語を更新',exact:true}).count(),0);
     assert.equal((await page.request.post(base+'/api/story',{headers:{'X-Expected-Personal-User-Id':user},data:{}})).status(),403);
    }
    await page.reload();await page.getByRole('heading',{name:'私の競泳物語',exact:true}).waitFor();await expected(page,false);
    assert.equal((await api(page,'/api/story')).body.user.id,user);
   }finally{await context.close();}
  }
  const {page,context}=await login('bug-admin');
  try{
   assert.equal((await api(page,'/api/story')).status,403);assert.equal((await api(page,'/api/timeline')).status,403);
   await page.goto(base+'/story');await page.waitForURL(url=>url.pathname==='/admin/users');
   await page.goto(base+'/timeline');await page.waitForURL(url=>url.pathname==='/admin/users');
  }finally{await context.close();}
  const unauth=await browser.newContext();try{for(const url of ['/api/story','/api/timeline'])assert.equal((await unauth.request.get(base+url)).status(),401)}finally{await unauth.close();}
 });

 test('after: Timeline default/list/filter/month boundaries, reload and Back/Forward render without the error boundary',async()=>{
  const {page,context}=await login('bug-boundary',{width:1280,height:900});
  try{
   const queries=['','?month=1970-01','?month=2100-12','?month=not-a-month&type=invalid&page=NaN','?view=list&type=story&page=1','?view=list&type=daily&page=1','?view=list&type=goal&page=1','?view=list&type=all&page=0'];
   for(const query of queries){
    await page.goto(base+'/timeline'+query);await page.getByRole('heading',{name:'記録',exact:true}).waitFor();
    await expected(page,false);assert.equal((await api(page,'/api/timeline'+query)).status,200);
    if(query.includes('view=list'))await page.getByRole('link',{name:'カレンダー',exact:true}).waitFor();
    else await page.getByRole('link',{name:'今月',exact:true}).waitFor();
   }
   await page.goto(base+'/timeline');await page.getByRole('link',{name:'今月',exact:true}).waitFor();
   await page.getByRole('link',{name:'前の月',exact:true}).click();await page.waitForURL(url=>url.searchParams.has('month'));
   await page.getByRole('link',{name:'今月',exact:true}).click();await page.getByRole('link',{name:'今月',exact:true}).waitFor();
   await page.reload();await page.getByRole('link',{name:'今月',exact:true}).waitFor();await expected(page,false);
   await page.getByRole('link',{name:'一覧',exact:true}).click();await page.waitForURL(url=>url.searchParams.get('view')==='list');
   await page.goBack();await page.getByRole('link',{name:'今月',exact:true}).waitFor();await expected(page,false);
   await page.goForward();await page.waitForURL(url=>url.searchParams.get('view')==='list');await page.getByRole('heading',{name:'記録',exact:true}).waitFor();await expected(page,false);
   assert.equal((await api(page,'/api/story')).body.user.id,'bug-boundary');
   assert.equal(diagnostic.length,0,'No React error-boundary errors after the fix');
  }finally{await context.close();}
 });
}
