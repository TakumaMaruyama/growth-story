import { parseDateOnly } from './date';

const JST = 'Asia/Tokyo';
const MILLISECONDS_PER_DAY = 86_400_000;
export const MIN_RECORD_MONTH = '1970-01';
export const MAX_RECORD_MONTH = '2100-12';
export const MAX_RECORD_PAGE = 1_000_000;

export const RECORD_VIEWS = ['calendar', 'list'] as const;
export type RecordView = (typeof RECORD_VIEWS)[number];

export const RECORD_TYPES = ['all', 'daily', 'goal', 'story'] as const;
export type RecordTypeFilter = (typeof RECORD_TYPES)[number];
export type RecordItemType = Exclude<RecordTypeFilter, 'all'>;

export interface RecordSearchParams {
    view?: string | string[];
    month?: string | string[];
    date?: string | string[];
    type?: string | string[];
    page?: string | string[];
}

export interface RecordSearchState {
    view: RecordView;
    month: string;
    date: string;
    type: RecordTypeFilter;
    page: number;
}

export interface RecordCalendarDay {
    dateKey: string;
    day: number;
    inCurrentMonth: boolean;
}

export interface RecordItem {
    id: string;
    type: RecordItemType;
    dateKey: string | null;
    occurredAt: string | null;
    sortKey: string | null;
    dateLabel: string;
    typeLabel: string;
    contextLabel: string | null;
    statusLabel: string | null;
    title: string;
    description: string | null;
    href: string;
}

function singleValue(value: string | string[] | undefined): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function dateKeyFromDate(date: Date): string {
    const year = String(date.getUTCFullYear()).padStart(4, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addUtcDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

export function isRecordMonthKey(value: string): boolean {
    const date = /^\d{4}-\d{2}$/.test(value) ? parseDateOnly(`${value}-01`) : null;
    return date !== null && value >= MIN_RECORD_MONTH && value <= MAX_RECORD_MONTH;
}

export function isRecordDateKey(value: string): boolean {
    return parseDateOnly(value) !== null;
}

export function shiftRecordMonth(month: string, amount: number): string {
    const firstDay = parseDateOnly(`${month}-01`);
    if (!firstDay || !Number.isInteger(amount)) throw new Error('Invalid record month');
    return dateKeyFromDate(new Date(Date.UTC(
        firstDay.getUTCFullYear(),
        firstDay.getUTCMonth() + amount,
        1,
    ))).slice(0, 7);
}

export function formatRecordMonth(month: string): string {
    const firstDay = parseDateOnly(`${month}-01`);
    if (!firstDay) throw new Error('Invalid record month');
    return `${firstDay.getUTCFullYear()}年${firstDay.getUTCMonth() + 1}月`;
}

export function getRecordMonthDateRange(month: string): {
    startKey: string;
    endKey: string;
    start: Date;
    end: Date;
} {
    const start = parseDateOnly(`${month}-01`);
    if (!start) throw new Error('Invalid record month');
    const endKey = `${shiftRecordMonth(month, 1)}-01`;
    const end = parseDateOnly(endKey);
    if (!end) throw new Error('Invalid next record month');
    return { startKey: `${month}-01`, endKey, start, end };
}

export function getRecordCalendarDays(month: string): RecordCalendarDay[] {
    const { start, end } = getRecordMonthDateRange(month);
    const gridStart = addUtcDays(start, -start.getUTCDay());
    const lastDay = addUtcDays(end, -1);
    const gridEnd = addUtcDays(lastDay, 7 - lastDay.getUTCDay());
    const days: RecordCalendarDay[] = [];

    for (let date = gridStart; date < gridEnd; date = addUtcDays(date, 1)) {
        const dateKey = dateKeyFromDate(date);
        days.push({
            dateKey,
            day: date.getUTCDate(),
            inCurrentMonth: dateKey.startsWith(`${month}-`),
        });
    }
    return days;
}

export function getRecordCalendarDateRange(month: string): {
    startKey: string;
    endKey: string;
    start: Date;
    end: Date;
} {
    const days = getRecordCalendarDays(month);
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    if (!firstDay || !lastDay) throw new Error('Record calendar is empty');
    const start = parseDateOnly(firstDay.dateKey);
    const last = parseDateOnly(lastDay.dateKey);
    if (!start || !last) throw new Error('Invalid record calendar range');
    const end = addUtcDays(last, 1);
    return {
        startKey: firstDay.dateKey,
        endKey: dateKeyFromDate(end),
        start,
        end,
    };
}

function parsePage(value: string | undefined): number {
    if (!value) return 1;
    if (!/^[1-9]\d*$/.test(value)) return 1;
    const page = Number(value);
    return Number.isSafeInteger(page) && page <= MAX_RECORD_PAGE ? page : 1;
}

export function parseRecordSearchParams(
    params: RecordSearchParams,
    today: string,
): RecordSearchState {
    if (!isRecordDateKey(today)) throw new Error('Invalid current date');

    const rawView = singleValue(params.view);
    const view: RecordView = rawView === 'list' ? 'list' : 'calendar';
    const rawType = singleValue(params.type);
    const type: RecordTypeFilter = RECORD_TYPES.includes(rawType as RecordTypeFilter)
        ? rawType as RecordTypeFilter
        : 'all';
    const defaultMonth = today.slice(0, 7);
    const rawMonth = singleValue(params.month);
    const month = rawMonth && isRecordMonthKey(rawMonth) ? rawMonth : defaultMonth;
    const rawDate = singleValue(params.date);
    const date = rawDate
        && isRecordDateKey(rawDate)
        && rawDate.startsWith(`${month}-`)
        ? rawDate
        : month === defaultMonth
            ? today
            : `${month}-01`;

    return {
        view,
        month,
        date,
        type,
        page: parsePage(singleValue(params.page)),
    };
}

export function recordHref(
    state: RecordSearchState,
    overrides: Partial<RecordSearchState> = {},
): string {
    const next = { ...state, ...overrides };
    const query = new URLSearchParams();
    query.set('view', next.view);
    query.set('month', next.month);
    query.set('date', next.date);
    if (next.type !== 'all') query.set('type', next.type);
    if (next.view === 'list' && next.page > 1) query.set('page', String(next.page));
    return `/timeline?${query.toString()}`;
}

const RECORD_TYPE_ORDER: Record<RecordItemType, number> = {
    daily: 0,
    goal: 1,
    story: 2,
};

/** 日付未設定を先頭にし、日付降順・日誌→大会目標→競泳物語の順で並べる。 */
export function sortRecordItems(items: readonly RecordItem[]): RecordItem[] {
    return [...items].sort((left, right) => {
        if (left.dateKey === null || right.dateKey === null) {
            if (left.dateKey === null && right.dateKey !== null) return -1;
            if (left.dateKey !== null && right.dateKey === null) return 1;
        }
        if (left.dateKey !== right.dateKey) {
            return (right.dateKey ?? '').localeCompare(left.dateKey ?? '');
        }
        const typeOrder = RECORD_TYPE_ORDER[left.type] - RECORD_TYPE_ORDER[right.type];
        if (typeOrder !== 0) return typeOrder;
        if (left.sortKey !== right.sortKey) {
            return (right.sortKey ?? '').localeCompare(left.sortKey ?? '');
        }
        return left.id.localeCompare(right.id);
    });
}

export function groupRecordItemsByDate(items: readonly RecordItem[]): Map<string, RecordItem[]> {
    const grouped = new Map<string, RecordItem[]>();
    for (const item of sortRecordItems(items)) {
        if (!item.dateKey) continue;
        const existing = grouped.get(item.dateKey) ?? [];
        existing.push(item);
        grouped.set(item.dateKey, existing);
    }
    return grouped;
}
