import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('admin member list exposes daily-log counts and earned badge colors', async () => {
    const [apiSource, pageSource] = await Promise.all([
        readFile(path.join(process.cwd(), 'src/app/api/admin/users/route.ts'), 'utf8'),
        readFile(path.join(process.cwd(), 'src/app/admin/users/page.tsx'), 'utf8'),
    ]);

    assert.match(apiSource, /dailyLogCount/);
    assert.match(apiSource, /dailyLogBadge/);
    assert.match(apiSource, /getDailyLogBadgeDisplay/);
    assert.match(apiSource, /logDate: \{ lte: todayDate \}/);
    assert.match(apiSource, /latestDailyLogDate/);
    assert.match(apiSource, /dailyLogDaysSinceLastEntry/);
    assert.match(apiSource, /latestDailyLogs/);
    assert.match(pageSource, /日誌記入回数/);
    assert.match(pageSource, /今日まで/);
    assert.match(pageSource, /admin-badge-chip/);
    assert.match(pageSource, /未獲得/);
    assert.match(pageSource, /最終日誌/);
    assert.match(pageSource, /最新更新/);
    assert.match(pageSource, /admin-users-registration/);
    assert.match(pageSource, /admin-user-actions/);
});
