import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { build } = createRequire(new URL('../../api-server/package.json', import.meta.url))('esbuild');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Japanese date-only display retains dates and weekdays in every browser timezone', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'daily-date-display-'));
    const outfile = path.join(dir, 'date.mjs');
    try {
        await build({ entryPoints: [path.join(root, 'src/lib/date.ts')], bundle: true, platform: 'node', format: 'esm', outfile });
        const checks = `
            import assert from 'node:assert/strict';
            import { formatDateOnlyWithWeekday, todayJST } from ${JSON.stringify(pathToFileURL(outfile).href)};
            const cases = [
                ['2026-10-11', '2026年10月11日（日）'],
                ['2026-10-12', '2026年10月12日（月）'],
                ['2026-10-13', '2026年10月13日（火）'],
                ['2026-10-14', '2026年10月14日（水）'],
                ['2026-10-15', '2026年10月15日（木）'],
                ['2026-10-16', '2026年10月16日（金）'],
                ['2026-10-17', '2026年10月17日（土）'],
                ['2026-01-31', '2026年1月31日（土）'],
                ['2026-02-01', '2026年2月1日（日）'],
                ['2025-12-31', '2025年12月31日（水）'],
                ['2026-01-01', '2026年1月1日（木）'],
                ['2024-02-29', '2024年2月29日（木）'],
                ['2024-03-01', '2024年3月1日（金）'],
                ['1970-01-01', '1970年1月1日（木）'],
            ];
            for (const [date, expected] of cases) assert.equal(formatDateOnlyWithWeekday(date), expected);
            for (const invalid of ['', '2026-02-29', '2026-13-01', '2026-1-1', '2026-10-13T00:00:00Z']) {
                assert.equal(formatDateOnlyWithWeekday(invalid), invalid);
            }
            assert.equal(formatDateOnlyWithWeekday(todayJST(new Date('2025-12-31T14:59:59Z'))), '2025年12月31日（水）');
            assert.equal(formatDateOnlyWithWeekday(todayJST(new Date('2025-12-31T15:00:00Z'))), '2026年1月1日（木）');
            assert.equal(formatDateOnlyWithWeekday(todayJST(new Date('2024-02-29T14:59:59Z'))), '2024年2月29日（木）');
            assert.equal(formatDateOnlyWithWeekday(todayJST(new Date('2024-02-29T15:00:00Z'))), '2024年3月1日（金）');
        `;
        for (const TZ of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Honolulu', 'Pacific/Kiritimati']) {
            execFileSync(process.execPath, ['--input-type=module', '-e', checks], { env: { ...process.env, TZ }, stdio: 'pipe' });
        }
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('the application declares Japanese as its document language', async () => {
    assert.match(await readFile(path.join(root, 'index.html'), 'utf8'), /<html\s+lang="ja">/);
});
