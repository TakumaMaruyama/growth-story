import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getJSTDateTimeRange,
    getRecordCalendarDateRange,
    getRecordCalendarDays,
    getRecordMonthDateRange,
    isRecordMonthKey,
    MAX_RECORD_PAGE,
    parseRecordSearchParams,
    recordHref,
    shiftRecordMonth,
    sortRecordItems,
    type RecordItem,
} from './records';

function item(overrides: Partial<RecordItem> & Pick<RecordItem, 'id' | 'type'>): RecordItem {
    return {
        dateKey: '2026-08-03',
        occurredAt: null,
        sortKey: null,
        dateLabel: '2026年8月3日',
        typeLabel: '日誌',
        contextLabel: null,
        statusLabel: null,
        title: overrides.id,
        description: '',
        href: '/',
        ...overrides,
    };
}

test('record query defaults to the current JST date and normalizes invalid values', () => {
    assert.deepEqual(parseRecordSearchParams({}, '2026-08-03'), {
        view: 'calendar',
        month: '2026-08',
        date: '2026-08-03',
        type: 'all',
        page: 1,
    });
    assert.deepEqual(parseRecordSearchParams({
        view: 'other',
        month: '2026-13',
        date: ['2026-08-02'],
        type: 'unknown',
        page: '0',
    }, '2026-08-03'), {
        view: 'calendar',
        month: '2026-08',
        date: '2026-08-03',
        type: 'all',
        page: 1,
    });
    assert.equal(parseRecordSearchParams({ month: '9999-12' }, '2026-08-03').month, '2026-08');
    assert.equal(
        parseRecordSearchParams({ view: 'list', page: String(MAX_RECORD_PAGE + 1) }, '2026-08-03').page,
        1,
    );
});

test('record query uses the first day when browsing another month', () => {
    assert.deepEqual(parseRecordSearchParams({
        view: 'list',
        month: '2024-02',
        type: 'goal',
        page: '3',
    }, '2026-08-03'), {
        view: 'list',
        month: '2024-02',
        date: '2024-02-01',
        type: 'goal',
        page: 3,
    });
});

test('record month helpers handle leap years and year boundaries', () => {
    assert.equal(isRecordMonthKey('1970-01'), true);
    assert.equal(isRecordMonthKey('2100-12'), true);
    assert.equal(isRecordMonthKey('1969-12'), false);
    assert.equal(isRecordMonthKey('2101-01'), false);
    assert.equal(shiftRecordMonth('2024-02', 1), '2024-03');
    assert.equal(shiftRecordMonth('2026-12', 1), '2027-01');
    assert.equal(shiftRecordMonth('2026-01', -1), '2025-12');
    const range = getRecordMonthDateRange('2024-02');
    assert.equal(range.startKey, '2024-02-01');
    assert.equal(range.endKey, '2024-03-01');
    assert.equal((range.end.getTime() - range.start.getTime()) / 86_400_000, 29);
});

test('calendar includes complete Sunday-to-Saturday weeks', () => {
    const days = getRecordCalendarDays('2026-08');
    assert.equal(days.length, 42);
    assert.equal(days[0]?.dateKey, '2026-07-26');
    assert.equal(days.at(-1)?.dateKey, '2026-09-05');
    assert.equal(days.filter((day) => day.inCurrentMonth).length, 31);

    const range = getRecordCalendarDateRange('2026-08');
    assert.equal(range.startKey, '2026-07-26');
    assert.equal(range.endKey, '2026-09-06');
});

test('story month boundaries are converted from JST to UTC instants', () => {
    const range = getJSTDateTimeRange('2026-08-01', '2026-09-01');
    assert.equal(range.start.toISOString(), '2026-07-31T15:00:00.000Z');
    assert.equal(range.end.toISOString(), '2026-08-31T15:00:00.000Z');
});

test('records sort undated first, then date descending and canonical type order', () => {
    const sorted = sortRecordItems([
        item({ id: 'story-old', type: 'story', occurredAt: '2026-08-03T01:00:00.000Z', sortKey: '2026-08-03T01:00:00.000Z' }),
        item({ id: 'goal-undated', type: 'goal', dateKey: null, dateLabel: '日付未設定' }),
        item({ id: 'goal', type: 'goal' }),
        item({ id: 'daily', type: 'daily' }),
        item({ id: 'story-new', type: 'story', occurredAt: '2026-08-03T02:00:00.000Z', sortKey: '2026-08-03T02:00:00.000Z' }),
        item({ id: 'daily-next', type: 'daily', dateKey: '2026-08-04' }),
    ]);
    assert.deepEqual(sorted.map((record) => record.id), [
        'goal-undated',
        'daily-next',
        'daily',
        'goal',
        'story-new',
        'story-old',
    ]);
});

test('record links preserve the selected view, date, filter and page', () => {
    const state = parseRecordSearchParams({ type: 'story' }, '2026-08-03');
    assert.equal(
        recordHref(state),
        '/timeline?view=calendar&month=2026-08&date=2026-08-03&type=story',
    );
    assert.equal(
        recordHref(state, { view: 'list', page: 2 }),
        '/timeline?view=list&month=2026-08&date=2026-08-03&type=story&page=2',
    );
    const listState = parseRecordSearchParams({
        view: 'list',
        month: '2024-02',
        date: '2024-02-20',
    }, '2026-08-03');
    assert.equal(
        recordHref(listState, { view: 'calendar' }),
        '/timeline?view=calendar&month=2024-02&date=2024-02-20',
    );
});
