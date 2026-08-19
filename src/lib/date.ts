import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const JST = 'Asia/Tokyo';
export const MIN_DAILY_LOG_DATE = '1970-01-01';

/**
 * 現在のJST日時を取得
 */
export function nowJST(): Date {
    return toZonedTime(new Date(), JST);
}

/**
 * 今日のJST日付をYYYY-MM-DD形式で取得
 */
export function todayJST(): string {
    return format(nowJST(), 'yyyy-MM-dd');
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

/** 日誌として受け付ける範囲（1970年以降〜JSTの今日まで）を検証する。 */
export function parseDailyLogDate(dateStr: string, now = new Date()): Date | null {
    const date = parseDateOnly(dateStr);
    if (!date) return null;

    const today = parseDateOnly(format(toZonedTime(now, JST), 'yyyy-MM-dd'))!;
    const earliest = parseDateOnly(MIN_DAILY_LOG_DATE)!;

    return date >= earliest && date <= today ? date : null;
}

/**
 * DateをJSTのYYYY-MM-DD形式に変換
 */
export function formatJSTDate(date: Date): string {
    return format(toZonedTime(date, JST), 'yyyy-MM-dd');
}

/**
 * DateをJSTの表示形式に変換
 */
export function formatJSTDisplay(date: Date): string {
    return format(toZonedTime(date, JST), 'yyyy年M月d日');
}

/**
 * DateをJSTの日時表示形式に変換
 */
export function formatJSTDateTime(date: Date): string {
    return format(toZonedTime(date, JST), 'yyyy年M月d日 HH:mm');
}
