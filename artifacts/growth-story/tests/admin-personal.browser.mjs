import assert from 'node:assert/strict';
import {test,before,beforeEach,after} from 'node:test';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const requireApi=createRequire(new URL('../../api-server/package.json',import.meta.url));
const pg=requireApi('pg');
assert.ok(process.env.PLAYWRIGHT_MODULE_PATH, 'Set PLAYWRIGHT_MODULE_PATH to a local Playwright installation');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base=new URL(process.env.TEST_API_BASE_URL);
const dbUrl=new URL(process.env.TEST_DATABASE_URL);
assert.ok(['127.0.0.1','localhost'].includes(base.hostname));
assert.ok(['127.0.0.1','localhost'].includes(dbUrl.hostname));
assert.equal(dbUrl.pathname,'/admin_personal_synthetic');
const pool=new pg.Pool({connectionString:dbUrl.href,max:1});
const output=process.env.TEST_SCREENSHOTS_DIR ?? '/tmp/swim-personal-screenshots';
let browser;
before(async()=>{
 await mkdir(output,{recursive:true});
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{} )});
 const rows=await pool.query('select login_id from users order by login_id');
 assert.deepEqual(rows.rows.map(row=>row.login_id),['fixture-admin','fixture-member','fixture-other'],'Synthetic fixtures are required');
});
// Isolate repeated login scenarios; DB/fixture allowlists above protect real records.
beforeEach(async()=>{await pool.query('delete from rate_limit_events');});
after(async()=>{await browser?.close();await pool.end()});
async function context(viewport){
 const ctx=await browser.newContext({viewport});
 await ctx.route('**/*',route=>new URL(route.request().url()).origin===base.origin ? route.continue() : route.abort());
 return ctx;
}
async function login(page,member=false,path=member?'/login':'/admin/login'){
 await page.goto(new URL(path,base).href);
 await page.getByLabel('ログインID',{exact:true}).fill(member?'fixture-member':'fixture-admin');
 await page.getByLabel('パスワード',{exact:true}).fill('Local-fixture-only-2026!');
 const loggedIn=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/auth/login'&&response.request().method()==='POST');
 await page.getByRole('button',{name:'ログイン',exact:true}).click();
 const response=await loggedIn;assert.equal(response.status(),200,JSON.stringify(await response.json()));
 await page.waitForURL(url=>!url.pathname.includes('login'));
}
async function assertOwn(page){
 const result=await page.request.get(new URL('/api/home',base).href);
 assert.equal(result.status(),200);const dto=await result.json();assert.equal(dto.user.id,'fixture-member');assert.equal(dto.user.role,'USER');assert.equal(dto.user.canSwitchToAdmin,true);
}
for(const [name,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}],['narrow',{width:320,height:720}]]){
 test(`${name}: same-cookie switching, all personal pages, reload and Back/Forward`,async()=>{
  const ctx=await context(viewport);const page=await ctx.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await login(page);
  const initialCookie=(await ctx.cookies()).find(cookie=>cookie.name==='swim_story_session').value;
  await page.getByRole('link',{name:'自分のページへ'}).click();
  await page.getByRole('link',{name:'管理画面へ'}).waitFor();
  await assertOwn(page);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Header must fit viewport');
  await page.screenshot({path:`${output}/${name}-personal.png`,fullPage:false});
  await page.reload();await page.getByRole('link',{name:'管理画面へ'}).waitFor();
  await page.getByRole('link',{name:'管理画面へ'}).click();await page.getByRole('link',{name:'自分のページへ'}).waitFor();await page.getByText('fixture-member',{exact:true}).filter({visible:true}).first().waitFor();
  await page.screenshot({path:`${output}/${name}-admin.png`,fullPage:false});
  await page.reload();await page.getByRole('link',{name:'自分のページへ'}).waitFor();await page.getByText('fixture-member',{exact:true}).filter({visible:true}).first().waitFor();
  await page.goBack();await page.getByRole('link',{name:'管理画面へ'}).waitFor();
  await page.goForward();await page.getByRole('link',{name:'自分のページへ'}).waitFor();await page.getByText('fixture-member',{exact:true}).filter({visible:true}).first().waitFor();
  console.log(name,'history succeeded',page.url());
  for(const path of ['/daily','/goals','/story','/story/edit','/story/history','/timeline']){
   console.log(name,'opening',path);
   await page.goto(new URL(path,base).href);
   await page.getByRole('link',{name:'管理画面へ'}).waitFor({timeout:5000}).catch(async(error)=>{console.log('FAILED_PAGE',page.url(),await page.locator('body').innerText());throw error});
   await assertOwn(page);await page.getByRole('link',{name:'管理画面へ'}).click();await page.getByRole('link',{name:'自分のページへ'}).waitFor();await page.getByText('fixture-member',{exact:true}).filter({visible:true}).first().waitFor();
   await page.getByRole('link',{name:'自分のページへ'}).click();await page.getByRole('link',{name:'管理画面へ'}).waitFor();
  }
  assert.equal((await ctx.cookies()).find(cookie=>cookie.name==='swim_story_session').value,initialCookie);
  assert.deepEqual(errors,[]);await ctx.close();
 });
}
test('unsaved daily, goal and story input survives canceled switching, switching and history/reload',async()=>{
 const ctx=await context({width:390,height:844});const page=await ctx.newPage();await login(page);
 for(const [path,field,text] of [['/daily','#quick-goodText','日誌の未保存入力'],['/goals','#new-goal-form textarea','大会目標の未保存入力'],['/story/edit','textarea[aria-label="Q1の回答"]','競泳物語の未保存入力']]){
  await page.goto(new URL(path==='/story/edit' ? '/story/edit?question=1' : path,base).href);await page.getByRole('link',{name:'管理画面へ'}).waitFor();
  if(path==='/goals')await page.getByRole('button',{name:'目標を追加',exact:true}).click();
  const locator=page.locator(field);await locator.fill(text);
  await page.waitForFunction(()=>Object.keys(sessionStorage).some(key=>key.startsWith('swim-story:draft:')));
  const cancel=page.waitForEvent('dialog').then(dialog=>dialog.dismiss());
  await page.getByRole('link',{name:'管理画面へ'}).click();await cancel;
  assert.equal(new URL(page.url()).pathname,path);assert.equal(await locator.inputValue(),text);
  const accept=page.waitForEvent('dialog').then(dialog=>dialog.accept());
  await page.getByRole('link',{name:'管理画面へ'}).click();await accept;await page.getByRole('link',{name:'自分のページへ'}).waitFor();await page.getByText('fixture-member',{exact:true}).filter({visible:true}).first().waitFor();
  await page.goBack();await page.getByRole('link',{name:'管理画面へ'}).waitFor();
  if(path==='/goals' && !await page.locator(field).isVisible())await page.getByRole('button',{name:'目標を追加',exact:true}).click();
  assert.equal(await page.locator(field).inputValue(),text);
  const reloading=page.waitForEvent('dialog').then(dialog=>dialog.accept());await page.reload();await reloading;
  await page.getByRole('link',{name:'管理画面へ'}).waitFor();
  if(path==='/goals' && !await page.locator(field).isVisible())await page.getByRole('button',{name:'目標を追加',exact:true}).click();
  assert.equal(await page.locator(field).inputValue(),text);
  // Move to next form only after accepting the existing unsaved warning.
  page.once('dialog',dialog=>dialog.accept());
 }
 await ctx.close();
});
test('ordinary member sees no administration switch; direct admin entry is refused',async()=>{
 const ctx=await context({width:390,height:844});const page=await ctx.newPage();await login(page,true);
 await page.getByRole('heading',{name:/おかえりなさい/}).waitFor();
 assert.equal(await page.getByRole('link',{name:'管理画面へ'}).count(),0);
 assert.equal((await page.request.get(new URL('/api/admin/users',base).href)).status(),403);
 await page.goto(new URL('/admin/users',base).href);await page.waitForURL(url=>url.pathname==='/');
 assert.equal(await page.getByRole('link',{name:'管理画面へ'}).count(),0);await ctx.close();
});
test('expired session cannot cross into admin and resumes personal deep page after re-login',async()=>{
 const ctx=await context({width:390,height:844});const page=await ctx.newPage();await login(page);
 await page.goto(new URL('/daily?date=2026-01-01',base).href);await page.getByRole('link',{name:'管理画面へ'}).waitFor();
 const oldCookie=(await ctx.cookies()).find(cookie=>cookie.name==='swim_story_session').value;
 await pool.query("update sessions set expires_at=timestamp '2000-01-01 00:00:00' where user_id='fixture-admin'");
 await page.getByRole('link',{name:'管理画面へ'}).click();await page.waitForURL(url=>url.pathname==='/admin/login');
 assert.equal((await page.request.get(new URL('/api/home',base).href)).status(),401);
 await page.goBack();
 await page.waitForURL(url=>url.pathname==='/login'||url.pathname==='/admin/login');
 assert.equal((await page.request.get(new URL('/api/admin/users',base).href)).status(),401);
 await page.goForward();
 await page.waitForURL(url=>url.pathname==='/login'||url.pathname==='/admin/login');
 assert.equal((await page.request.get(new URL('/api/home',base).href)).status(),401);
 await page.goto(new URL('/daily?date=2026-01-01',base).href);await page.waitForURL(url=>url.pathname==='/login');
 assert.equal(new URL(page.url()).searchParams.get('next'),'/daily?date=2026-01-01');
 await page.getByLabel('ログインID',{exact:true}).fill('fixture-admin');await page.getByLabel('パスワード',{exact:true}).fill('Local-fixture-only-2026!');await page.getByRole('button',{name:'ログイン',exact:true}).click();
 await page.waitForURL(url=>url.pathname==='/daily'&&url.search==='?date=2026-01-01');await page.getByRole('link',{name:'管理画面へ'}).waitFor();
 assert.notEqual((await ctx.cookies()).find(cookie=>cookie.name==='swim_story_session').value,oldCookie);await assertOwn(page);
 await ctx.close();
});

test('stale forms cannot save to another login; drafts remain readable and are isolated by subject id',async()=>{
 for(const [path,field,text,save] of [
  ['/daily','#quick-goodText','別ログイン前の日誌','今日の記録を保存'],
  ['/goals','#new-goal-form textarea','別ログイン前の目標','この目標を追加'],
  ['/story/edit?question=1','textarea[aria-label="Q1の回答"]','別ログイン前の物語','更新内容を保存'],
 ]){
  console.log('STALE_START',path);
  const ctx=await context({width:390,height:844});const page=await ctx.newPage();await login(page);
  await page.goto(new URL(path,base).href);await page.getByRole('link',{name:'管理画面へ'}).waitFor();
  if(path==='/goals'){
   await page.getByRole('button',{name:'目標を追加',exact:true}).click();
   await page.locator('#new-goal-form .goal-title-input').fill('本人の未保存目標');
  }
  console.log('STALE_FIELD',path);
  const input=page.locator(field);await input.fill(text);
  await page.waitForFunction(()=>Object.keys(sessionStorage).some(key=>key.includes('fixture-member')));
  const loginOther=await page.request.post(new URL('/api/auth/login',base).href,{data:{loginId:'fixture-other',password:'Local-fixture-only-2026!',adminOnly:false}});assert.equal(loginOther.status(),200);
  console.log('STALE_LOGIN_CHANGED',path);
  const failed=page.waitForResponse(response=>response.request().method()!=='GET'&&response.url().includes('/api/')&&response.status()===409);
  await page.getByRole('button',{name:save,exact:true}).click();
  assert.equal((await (await failed).json()).code,'PERSONAL_SUBJECT_CHANGED');
  await page.getByText('ログイン中のアカウントまたは会員ページの対象が変わりました。入力は未保存です。必要な内容をコピーしてから再読み込みしてください。',{exact:true}).waitFor();
  assert.equal(await input.inputValue(),text);assert.equal(await input.isDisabled(),false,'Input must remain selectable for copying');
  await input.focus();await input.press('Meta+a');
  assert.equal(await input.evaluate(element=>element.value.substring(element.selectionStart,element.selectionEnd)),text);
  assert.equal(await page.getByRole('button',{name:save,exact:true}).isDisabled(),true);
  console.log('STALE_COPY_PASS',path);
  const reloading=page.waitForEvent('dialog').then(dialog=>dialog.accept());await page.reload();await reloading;
  console.log('STALE_RELOADED',path,page.url());
  await page.getByText('別会員',{exact:true}).waitFor({state:'attached'});
  if(path==='/goals')await page.getByRole('button',{name:'目標を追加',exact:true}).click();
  if(await input.isVisible()) assert.notEqual(await input.inputValue(),text);
  else assert.ok(!(await page.locator('body').innerText()).includes(text));
  assert.equal(await page.getByRole('link',{name:'管理画面へ'}).count(),0);
  assert.ok(await page.evaluate(()=>Object.keys(sessionStorage).some(key=>key.includes('fixture-member'))),'Old subject draft stays under its own key');
  assert.equal((await pool.query("select count(*)::int as count from daily_logs where user_id='fixture-other'")).rows[0].count,0);
  console.log('STALE_DONE',path);
  await ctx.close();
 }
});
