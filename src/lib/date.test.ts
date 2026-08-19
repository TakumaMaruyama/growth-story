import assert from 'node:assert/strict';
import test from 'node:test';
import { formatJSTDate, parseDailyLogDate, parseDateOnly } from './date';

test('parseDateOnly accepts a real calendar date', () => {
    const date = parseDateOnly('2024-02-29');
    assert.ok(date);
    assert.equal(date.toISOString(), '2024-02-29T00:00:00.000Z');
    assert.equal(formatJSTDate(date), '2024-02-29');
});

test('parseDateOnly rejects malformed and impossible dates', () => {
    for (const value of ['2023-02-29', '2026-13-01', '2026-04-31', '2026-8-1', '', 'not-a-date']) {
        assert.equal(parseDateOnly(value), null, value);
    }
});

test('parseDailyLogDate accepts today and past dates but rejects future dates in JST', () => {
    const now = new Date('2026-08-20T03:00:00.000Z');

    assert.ok(parseDailyLogDate('1970-01-01', now));
    assert.ok(parseDailyLogDate('2026-08-19', now));
    assert.ok(parseDailyLogDate('2026-08-20', now));
    assert.equal(parseDailyLogDate('2026-08-21', now), null);
});
