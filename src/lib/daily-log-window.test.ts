import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDailyLogDate } from './date';
import { earliestWritableDailyLogDate, isDailyLogWritable } from './daily-log-window';
import { parseDailyLogInput } from './validation';

test('daily logs allow today and exactly seven days ago, but reject eight days ago and tomorrow', () => {
    const today = '2026-09-11';
    assert.equal(earliestWritableDailyLogDate(today), '2026-09-04');
    for (const date of ['2026-09-11', '2026-09-10', '2026-09-04']) {
        assert.equal(isDailyLogWritable(date, today), true, date);
    }
    for (const date of ['2026-09-03', '1970-01-01', '2026-09-12', '2026-9-4', '2026-02-30', '']) {
        assert.equal(isDailyLogWritable(date, today), false, date);
    }
    assert.ok(parseDailyLogDate('2020-01-01', new Date('2026-09-11T00:00:00Z')),
        'historical records remain readable');
});

test('write windows cross month, year and leap-day boundaries', () => {
    assert.equal(earliestWritableDailyLogDate('2026-09-03'), '2026-08-27');
    assert.equal(earliestWritableDailyLogDate('2026-01-03'), '2025-12-27');
    assert.equal(earliestWritableDailyLogDate('2024-03-07'), '2024-02-29');
    assert.equal(earliestWritableDailyLogDate('2025-03-07'), '2025-02-28');
});

test('server validation applies the JST window to new entries and edits across midnight', (context) => {
    context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-11T14:59:59.999Z') });
    const body = { date: '2026-09-04', score: 8, activityType: 'PRACTICE' };
    for (const baseRevision of [null, 1]) {
        assert.equal(parseDailyLogInput({ ...body, baseRevision }).ok, true);
        assert.equal(parseDailyLogInput({ ...body, date: '2026-09-03', baseRevision }).ok, false);
        assert.equal(parseDailyLogInput({ ...body, date: '2026-09-12', baseRevision }).ok, false);
    }
    context.mock.timers.tick(1);
    for (const baseRevision of [null, 1]) {
        assert.equal(parseDailyLogInput({ ...body, baseRevision }).ok, false,
            'the previously open oldest day expires at JST midnight');
        assert.equal(parseDailyLogInput({ ...body, date: '2026-09-12', baseRevision }).ok, true);
    }
});
