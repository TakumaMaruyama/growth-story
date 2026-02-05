import { format, parseISO, startOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const JST = 'Asia/Tokyo';

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

/**
 * 日付文字列をJST Date に変換
 */
export function parseJSTDate(dateStr: string): Date {
    return fromZonedTime(startOfDay(parseISO(dateStr)), JST);
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
