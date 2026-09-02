import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('admin daily-log navigation uses canonical date keys and linked member names', async () => {
    const [dailyApi, dailyPage, usersPage] = await Promise.all([
        readFile(path.join(process.cwd(), 'src/app/api/admin/users/[userId]/daily/route.ts'), 'utf8'),
        readFile(path.join(process.cwd(), 'src/app/admin/users/[userId]/daily/page.tsx'), 'utf8'),
        readFile(path.join(process.cwd(), 'src/app/admin/users/page.tsx'), 'utf8'),
    ]);

    assert.match(dailyApi, /formatJSTDate\(log\.logDate\)/);
    assert.match(dailyApi, /logs: logs\.map/);
    assert.match(dailyPage, /daily\/\$\{log\.logDate\}/);
    assert.doesNotMatch(dailyPage, /log\.logDate\.slice\(0, 10\)/);
    assert.match(usersPage, /href=\{`\/admin\/users\/\$\{encodeURIComponent\(target\.id\)\}`\}/);
    assert.match(usersPage, /本名未登録/);
});
