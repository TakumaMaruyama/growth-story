import type {
    CompetitionGoalApiType,
    CompetitionGoalDatabaseType,
} from './competition-goal-contract';

export type CompetitionGoalDisplayType =
    | CompetitionGoalApiType
    | CompetitionGoalDatabaseType;

export type CompetitionGoalTextField = 'title' | 'details';

type CompetitionGoalDateValue = Date | string | null;

interface SortableCompetitionGoal {
    id?: string | null;
    targetDate: CompetitionGoalDateValue;
    updatedAt?: Date | string;
}

function competitionGoalDateKey(value: CompetitionGoalDateValue): string | null {
    if (!value) return null;
    if (typeof value === 'string') {
        const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
        return match?.[1] ?? null;
    }
    if (Number.isNaN(value.getTime())) return null;
    const year = String(value.getUTCFullYear()).padStart(4, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function competitionGoalUpdatedAt(value: Date | string | undefined): number {
    if (!value) return 0;
    const time = value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isNaN(time) ? 0 : time;
}

/**
 * 大会目標の共通表示順。これからの日付が近い順、日付未定、
 * 経過済みの日付が新しい順で並べる。
 */
export function sortCompetitionGoalsForDisplay<T extends SortableCompetitionGoal>(
    goals: readonly T[],
    today: string,
): T[] {
    const group = (goal: T): number => {
        const date = competitionGoalDateKey(goal.targetDate);
        if (!date) return 1;
        return date >= today ? 0 : 2;
    };

    return [...goals].sort((left, right) => {
        const leftGroup = group(left);
        const rightGroup = group(right);
        if (leftGroup !== rightGroup) return leftGroup - rightGroup;

        const leftDate = competitionGoalDateKey(left.targetDate);
        const rightDate = competitionGoalDateKey(right.targetDate);
        if (leftDate && rightDate && leftDate !== rightDate) {
            return leftGroup === 2
                ? rightDate.localeCompare(leftDate)
                : leftDate.localeCompare(rightDate);
        }

        const updatedOrder = competitionGoalUpdatedAt(right.updatedAt)
            - competitionGoalUpdatedAt(left.updatedAt);
        if (updatedOrder !== 0) return updatedOrder;
        return (left.id ?? '').localeCompare(right.id ?? '');
    });
}

export function findNextMeetGoalId<T extends SortableCompetitionGoal & {
    id: string;
    type: CompetitionGoalDisplayType;
}>(goals: readonly T[], today: string): string | null {
    return sortCompetitionGoalsForDisplay(goals, today).find((goal) => {
        const targetDate = competitionGoalDateKey(goal.targetDate);
        return (goal.type === 'next_meet' || goal.type === 'NEXT_MEET')
            && targetDate !== null
            && targetDate >= today;
    })?.id ?? null;
}

export function isCompetitionGoalElapsed(
    goal: Pick<SortableCompetitionGoal, 'targetDate'>,
    today: string,
): boolean {
    const targetDate = competitionGoalDateKey(goal.targetDate);
    return targetDate !== null && targetDate < today;
}

export function getCompetitionGoalFieldMapping(type: CompetitionGoalDisplayType): {
    meetNameField: CompetitionGoalTextField;
    goalTextField: CompetitionGoalTextField;
} {
    const milestone = type === 'milestone' || type === 'MILESTONE';
    return milestone
        ? { meetNameField: 'title', goalTextField: 'details' }
        : { meetNameField: 'details', goalTextField: 'title' };
}

export function getCompetitionGoalDisplayValues(goal: {
    type: CompetitionGoalDisplayType;
    title: string;
    details: string | null;
}): { meetName: string; goalText: string } {
    const { meetNameField, goalTextField } = getCompetitionGoalFieldMapping(goal.type);
    return {
        meetName: (goal[meetNameField] ?? '').trim(),
        goalText: (goal[goalTextField] ?? '').trim(),
    };
}
