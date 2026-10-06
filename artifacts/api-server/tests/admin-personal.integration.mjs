import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import pg from 'pg';
import bcrypt from 'bcrypt';

// Run only against a disposable local database with synthetic fixtures.
const dbUrl = new URL(process.env.TEST_DATABASE_URL ?? 'postgresql://localhost/admin_personal_synthetic');
const base = new URL(process.env.TEST_API_BASE_URL ?? 'http://127.0.0.1:55450');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(dbUrl.hostname));
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname));
assert.equal(dbUrl.pathname, '/admin_personal_synthetic');
assert.ok(process.env.TEST_DATABASE_URL && process.env.TEST_API_BASE_URL, 'Explicit disposable test endpoints are required');
const pool = new pg.Pool({ connectionString: dbUrl.href, max: 1 });
const password = 'Local-fixture-only-2026!';
const date = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(new Date());
let adminCookie, memberCookie;
async function request(path, cookie, method = 'GET', body, expected = 'fixture-member') {
    const response = await fetch(new URL(path, base), {
        method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? {'Content-Type': 'application/json'} : {}), ...(method !== 'GET' && expected !== null ? {'X-Expected-Personal-User-Id':expected}: {}) },
        ...(body ? {body: JSON.stringify(body)} : {}),
    });
    return {response, body: await response.json()};
}
async function login(loginId, adminOnly) {
    const {response, body} = await request('/api/auth/login', null, 'POST', {loginId, password, adminOnly});
    assert.equal(response.status, 200, JSON.stringify(body));
    return response.headers.getSetCookie().find(value => value.startsWith('swim_story_session=')).split(';')[0];
}
before(async () => {
    const tables = await pool.query('select count(*)::int as count from users');
    assert.equal(tables.rows[0].count, 0, 'Fixture DB must be empty; existing records must never be touched');
    const hash = await bcrypt.hash(password, 12);
    for (const [id, role, name] of [['fixture-admin','ADMIN','管理者本人'], ['fixture-member','USER','会員本人'], ['fixture-other','USER','別会員']]) {
        await pool.query('insert into users (id, login_id, display_name, role, password_hash, family_name, given_name, updated_at) values ($1,$1,$2,$3,$4,$5,$6,now())', [id,name,role,hash,'検証',name]);
    }
    await pool.query("insert into competition_goals (id,user_id,goal_type,title,updated_at) values ('other-goal','fixture-other','NEXT_MEET','別会員専用',now())");
    await pool.query("insert into story_versions (id,user_id,version,note) values ('other-story','fixture-other',1,'別会員専用')");
    await pool.query("insert into story_answers (id,story_version_id,question_no,answer_text) values ('other-answer','other-story',1,'別会員の回答')");
    await pool.query("insert into daily_logs (id,user_id,log_date,score,good_text,updated_at) values ('existing-member-log','fixture-member','2026-01-01',8,'既存の本人記録',now()), ('actor-only-log','fixture-admin','2026-01-01',3,'管理者IDの記録',now())");
    adminCookie = await login('fixture-admin', true);
    memberCookie = await login('fixture-member', false);
});
after(async () => { await pool.end(); });

test('paired administrator keeps actor session and reads the existing USER subject on every personal read', async () => {
    for (const path of ['/api/home','/api/daily','/api/goals','/api/story','/api/story/history','/api/timeline?view=calendar']) {
        const {response, body} = await request(path, adminCookie);
        assert.equal(response.status, 200, `${path}: ${JSON.stringify(body)}`);
        assert.equal(body.user.id, 'fixture-member');
        assert.equal(body.user.role, 'USER');
        assert.equal(body.user.canSwitchToAdmin, true);
        assert.equal(response.headers.get('set-cookie'), null, 'Switching must not replace the session');
    }
    assert.equal((await request('/api/admin/users', adminCookie)).response.status, 200);
    const sessions = await pool.query("select user_id, count(*)::int as count from sessions group by user_id");
    assert.equal(sessions.rows.find(row => row.user_id === 'fixture-admin').count, 1);
});

test('paired administrator writes only the existing member records and never ADMIN records', async () => {
    const log = {date, baseRevision:null, score:7, activityType:'PRACTICE', goodText:'管理者本人のみ', improveText:'', tomorrowText:''};
    assert.equal((await request('/api/daily',adminCookie,'POST',log)).response.status,200);
    assert.equal((await request('/api/daily',adminCookie,'POST',{...log,userId:'fixture-other'})).response.status,400);
    const own = await request(`/api/daily?date=${date}&userId=fixture-other`,adminCookie);
    assert.equal(own.body.user.id,'fixture-member');
    assert.equal(own.body.log.goodText,'管理者本人のみ');
    assert.equal((await pool.query('select user_id from daily_logs where log_date=$1',[date])).rows[0].user_id,'fixture-member');
    const created = await request('/api/goals',adminCookie,'POST',{type:'next_meet',title:'本人の大会',details:'本人の目標',targetDate:date});
    assert.equal(created.response.status,201,JSON.stringify(created.body));
    const id = created.body.goal.id;
    assert.equal((await request(`/api/goals/${id}`,adminCookie,'PATCH',{baseRevision:1,title:'本人の更新'})).response.status,200);
    assert.equal((await request(`/api/goals/${id}`,adminCookie,'DELETE',{baseRevision:2})).response.status,200);
    assert.equal((await request(`/api/goals/${id}/permanent`,adminCookie,'DELETE',{baseRevision:3})).response.status,200);
    const saved = await request('/api/story',adminCookie,'POST',{baseVersion:null,answers:{1:'管理者本人の物語'},note:'本人'});
    assert.equal(saved.response.status,200,JSON.stringify(saved.body));
    const current = await request('/api/story',adminCookie);
    assert.equal(current.body.story.content,'管理者本人の物語');
    assert.ok(Number.isFinite(Date.parse(current.body.story.createdAt)));
    assert.equal(current.body.isReadOnly,false);
    const history = await request('/api/story/history',adminCookie);
    const version = await request(`/api/story/history/${history.body.versions[0].id}`,adminCookie);
    assert.equal(version.body.user.id,'fixture-member');
    assert.equal(version.body.story.content,'管理者本人の物語');
});

test('personal routes cannot read or edit another account through an id or query parameter', async () => {
    for (const cookie of [adminCookie,memberCookie]) {
        assert.equal((await request('/api/story/history/other-story',cookie)).response.status,404);
        assert.equal((await request('/api/goals/other-goal',cookie,'PATCH',{baseRevision:1,title:'書換'})).response.status,404);
        assert.equal((await request('/api/goals/other-goal',cookie,'DELETE',{baseRevision:1})).response.status,404);
        assert.equal((await request('/api/goals/other-goal/permanent',cookie,'DELETE',{baseRevision:1})).response.status,404);
        const goals=await request('/api/goals?userId=fixture-other',cookie);
        assert.ok(!goals.body.goals.some(goal=>goal.id==='other-goal'));
    }
    assert.equal((await pool.query("select title from competition_goals where id='other-goal'")).rows[0].title,'別会員専用');
});

test('ordinary members keep personal access and get 403 on every administration route', async () => {
    assert.equal((await request('/api/home',memberCookie)).body.user.role,'USER');
    const paths = ['/api/admin/registration-link','/api/admin/users','/api/admin/users/fixture-admin','/api/admin/users/fixture-admin/daily',`/api/admin/users/fixture-admin/daily/${date}`,'/api/admin/users/fixture-admin/goals','/api/admin/users/fixture-admin/story','/api/admin/users/fixture-admin/story/other-story'];
    for (const path of paths) assert.equal((await request(path,memberCookie)).response.status,403,path);
    for (const action of ['membership','password-reset','toggle']) assert.equal((await request(`/api/admin/users/fixture-admin/${action}`,memberCookie,'POST',{})).response.status,403,action);
});

test('withdrawn subject is readable but blocks every write from the paired administrator', async () => {
    await pool.query("update users set membership_status='WITHDRAWN', withdrawn_at=now() where id='fixture-member'");
    for (const path of ['/api/daily','/api/goals','/api/story']) {
        const result=await request(path,adminCookie,'POST',{});
        assert.equal(result.response.status,403,path);
        assert.equal(result.body.code,'MEMBERSHIP_WITHDRAWN');
    }
    assert.equal((await request('/api/home',adminCookie)).response.status,200);
    await pool.query("update users set membership_status='ACTIVE', withdrawn_at=null where id='fixture-member'");
});

test('stale or missing subject headers refuse all personal write methods without selecting any target', async () => {
    for (const expected of [null,'fixture-admin','fixture-other']) {
        for (const [path,method] of [['/api/daily','POST'],['/api/story','POST'],['/api/goals','POST'],['/api/goals/other-goal','PATCH'],['/api/goals/other-goal','DELETE'],['/api/goals/other-goal/permanent','DELETE']]) {
            const result=await request(path,adminCookie,method,{},expected);
            assert.equal(result.response.status,409,`${method} ${path}`);
            assert.equal(result.body.code,'PERSONAL_SUBJECT_CHANGED');
        }
    }
    assert.equal((await request('/api/daily',memberCookie,'POST',{},null)).response.status,409);
    assert.equal((await request('/api/home',memberCookie)).body.user.canSwitchToAdmin,false);
    assert.equal((await request('/api/auth/account-switch',memberCookie)).body.canSwitchToMember,false);
    assert.equal((await request('/api/auth/account-switch',adminCookie)).body.canSwitchToMember,true);
    const existing=await request('/api/daily?date=2026-01-01',adminCookie);
    assert.equal(existing.body.log.goodText,'既存の本人記録');
    assert.equal((await pool.query("select good_text from daily_logs where id='actor-only-log'")).rows[0].good_text,'管理者IDの記録');
});

test('inactive or non-USER subject denies paired access without administrator fallback', async () => {
    for (const state of ["is_active=false","role='ADMIN'"]) {
        await pool.query(`update users set ${state} where id='fixture-member'`);
        const result=await request('/api/home',adminCookie);
        assert.equal(result.response.status,403);
        assert.equal(result.body.code,'PERSONAL_ACCESS_UNAVAILABLE');
        assert.equal((await request('/api/auth/account-switch',adminCookie)).body.canSwitchToMember,false);
        assert.equal((await request('/api/admin/users',adminCookie)).response.status,200);
        await pool.query("update users set is_active=true,role='USER' where id='fixture-member'");
    }
});

test('expired and missing sessions get 401 on both personal and administration APIs', async () => {
    const expiring=await login('fixture-admin',true);
    await pool.query("update sessions set expires_at=timestamp '2000-01-01 00:00:00' where user_id='fixture-admin'");
    for (const cookie of [null,expiring]) {
        for (const path of ['/api/home','/api/daily','/api/goals','/api/story','/api/story/history','/api/timeline','/api/admin/users']) assert.equal((await request(path,cookie)).response.status,401,path);
        for (const path of ['/api/daily','/api/goals','/api/story']) assert.equal((await request(path,cookie,'POST',{})).response.status,401,path);
    }
});
