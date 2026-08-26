export const DAILY_ACTIVITY_TYPES = ['PRACTICE', 'COMPETITION', 'REST'] as const;

export type DailyActivityType = typeof DAILY_ACTIVITY_TYPES[number];

export function isDailyActivityType(value: unknown): value is DailyActivityType {
    return typeof value === 'string'
        && DAILY_ACTIVITY_TYPES.includes(value as DailyActivityType);
}

export function dailyActivityFromPracticed(practiced: boolean): DailyActivityType {
    return practiced ? 'PRACTICE' : 'REST';
}

export function isPracticedActivity(activityType: DailyActivityType): boolean {
    return activityType !== 'REST';
}

export function getDailyActivityLabel(activityType: DailyActivityType): string {
    switch (activityType) {
        case 'PRACTICE':
            return '練習';
        case 'COMPETITION':
            return '大会';
        case 'REST':
            return 'お休み';
    }
}
