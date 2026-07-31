import assert from 'node:assert/strict';
import test from 'node:test';
import { formatJSTDate, parseDateOnly } from './date';

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
