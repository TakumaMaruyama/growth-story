import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const CORE_FEATURE_LABELS = ['練習日誌', '大会目標', '競泳物語'] as const;

async function readSource(relativePath: string): Promise<string> {
    return readFile(path.join(process.cwd(), relativePath), 'utf8');
}

function assertOrdered(source: string, markers: readonly string[], area: string): void {
    const positions = markers.map((marker) => source.indexOf(marker));
    assert.ok(
        positions.every((position) => position >= 0),
        `${area} is missing one of: ${markers.join(', ')}`,
    );
    assert.ok(
        positions.every((position, index) => {
            const previous = positions[index - 1];
            return index === 0 || (previous !== undefined && previous < position);
        }),
        `${area} must follow ${CORE_FEATURE_LABELS.join(' → ')}`,
    );
}

test('desktop and mobile navigation share the canonical feature order', async () => {
    const source = await readSource('src/components/Nav.tsx');
    const links = source.slice(source.indexOf('const USER_LINKS'), source.indexOf('const ADMIN_LINKS'));

    assertOrdered(links, ["href: '/daily'", "href: '/goals'", "href: '/story'"], 'user navigation');
    assert.match(links, /href: '\/timeline', label: '記録'/);
    assert.equal(source.includes('MOBILE_USER_LINKS'), false);
    assert.match(source, /const links = isAdmin \? ADMIN_LINKS : USER_LINKS/);
    assert.equal(source.match(/\{USER_LINKS\.map/g)?.length, 1);
});

test('home actions, summaries and sections use the canonical feature order', async () => {
    const source = await readSource('src/app/page.tsx');
    const hero = source.slice(source.indexOf('<section className="card hero"'), source.indexOf('</section>', source.indexOf('<section className="card hero"')));
    const summaries = source.slice(source.indexOf('aria-label="記録のサマリー"'), source.indexOf('</section>', source.indexOf('aria-label="記録のサマリー"')));

    assertOrdered(hero, [
        'href={`/daily?date=${today}`}',
        "href={isReadOnly ? '/goals' : '/goals?add=1'}",
        "href={isReadOnly ? '/story' : '/story/edit'}",
    ], 'home actions');
    assertOrdered(summaries, ['練習日誌の記録', '設定中の大会目標', '競泳物語の更新'], 'home summaries');
    assertOrdered(source, ['aria-labelledby="today-heading"', 'aria-labelledby="goals-heading"', 'aria-labelledby="story-heading"'], 'home sections');
});

test('admin overview and record empty state use the canonical feature order', async () => {
    const adminSource = await readSource('src/app/admin/users/[userId]/page.tsx');
    const timelineSource = await readSource('src/app/timeline/page.tsx');

    assertOrdered(adminSource, ['練習日誌一覧', '大会目標</Link>', '競泳物語履歴'], 'admin detail actions');
    assertOrdered(timelineSource, ['日誌を書く', '大会目標を追加', '競泳物語を書く'], 'record empty state actions');
});

test('home links to the combined record calendar and list', async () => {
    const source = await readSource('src/app/page.tsx');
    assert.match(source, />これまでの記録<\/h2>/);
    assert.match(source, /日誌、大会目標、競泳物語を、カレンダーと一覧で確認できます。/);
    assert.match(source, /href="\/timeline"[^>]*>記録を開く<\/Link>/);
});

test('authentication copy introduces the three features in the canonical order', async () => {
    const loginSource = await readSource('src/components/LoginForm.tsx');
    const registerSource = await readSource('src/app/register/page.tsx');

    assert.match(loginSource, /練習日誌、大会目標、競泳物語を、自分の言葉で残す場所。/);
    assert.match(registerSource, /練習日誌、大会目標、競泳物語を始めましょう。/);
});
