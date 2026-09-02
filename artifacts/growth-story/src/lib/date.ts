import { format } from 'date-fns';

const JST = 'Asia/Tokyo';
const DATE_ONLY_MILLISECONDS = 24 * 60 * 60 * 1000;
export const MIN_DAILY_LOG_DATE = '1970-01-01';

/**
 * 現在のJST日時を取得
 */
export function nowJST(): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: JST,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const vals = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return new Date(`${vals.year}-${vals.month}-${vals.day}T${vals.hour}:${vals.minute}:${vals.second}Z`);
}

/**
 * 今日のJST日付をYYYY-MM-DD形式で取得
 */
export function todayJST(now = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: JST,
        year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}

/** YYYY-MM-DD を UTC 0時の Date に変換する。無効な日付は null。 */
export function parseDateOnly(dateStr: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return date;
}

/** UTC 0時のDate同士から、日付だけの経過日数を取得する。 */
export function differenceInDateOnlyDays(later: Date, earlier: Date): number {
    return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / DATE_ONLY_MILLISECONDS));
}

/** 日誌として受け付ける範囲（1970年以降〜JSTの今日まで）を検証する。 */
export function parseDailyLogDate(dateStr: string, now = new Date()): Date | null {
    const date = parseDateOnly(dateStr);
    if (!date) return null;
    
    const today = parseDateOnly(todayJST(now))!;
    const earliest = parseDateOnly(MIN_DAILY_LOG_DATE)!;

    return date >= earliest && date <= today ? date : null;
}

function convertToJST(date: Date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: JST,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const parts = formatter.formatToParts(date);
    const vals = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return new Date(`${vals.year}-${vals.month}-${vals.day}T${vals.hour}:${vals.minute}:${vals.second}`);
}

/**
 * DateをJSTのYYYY-MM-DD形式に変換
 */
export function formatJSTDate(date: Date): string {
    return format(convertToJST(date), 'yyyy-MM-dd');
}

/**
 * DateをJSTの表示形式に変換
 */
export function formatJSTDisplay(date: Date): string {
    return format(convertToJST(date), 'yyyy年M月d日');
}

/**
 * DateをJSTの日時表示形式に変換
 */
export function formatJSTDateTime(date: Date): string {
    return format(convertToJST(date), 'yyyy年M月d日 HH:mm');
}
