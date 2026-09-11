import { parseDateOnly, todayJST } from './date';

export const DAILY_LOG_WRITE_WINDOW_CODE = 'DAILY_LOG_WRITE_WINDOW_CLOSED';
export const DAILY_LOG_WRITE_WINDOW_MESSAGE = '日誌の記入・編集は今日から7日前までです。それより前の記録は閲覧のみできます。';

/** 日本時間の今日と7日前を両端に含む、日付だけの記入可能期間。 */
export function earliestWritableDailyLogDate(today = todayJST()): string {
    const date = parseDateOnly(today);
    if (!date) throw new Error('Invalid daily-log reference date');
    date.setUTCDate(date.getUTCDate() - 7);
    return date.toISOString().slice(0, 10);
}

export function isDailyLogWritable(date: string, today = todayJST()): boolean {
    return parseDateOnly(date) !== null
        && date >= earliestWritableDailyLogDate(today)
        && date <= today;
}

export class DailyLogWriteWindowError extends Error {
    constructor() {
        super(DAILY_LOG_WRITE_WINDOW_MESSAGE);
    }
}
