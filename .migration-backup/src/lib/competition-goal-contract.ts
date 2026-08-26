import { formatJSTDate } from './date';

export const COMPETITION_GOAL_TYPES = ['next_meet', 'annual', 'milestone'] as const;
export type CompetitionGoalApiType = (typeof COMPETITION_GOAL_TYPES)[number];
export type CompetitionGoalDatabaseType = 'NEXT_MEET' | 'ANNUAL' | 'MILESTONE';

const API_TO_DATABASE_TYPE: Record<CompetitionGoalApiType, CompetitionGoalDatabaseType> = {
    next_meet: 'NEXT_MEET',
    annual: 'ANNUAL',
    milestone: 'MILESTONE',
};

const DATABASE_TO_API_TYPE: Record<CompetitionGoalDatabaseType, CompetitionGoalApiType> = {
    NEXT_MEET: 'next_meet',
    ANNUAL: 'annual',
    MILESTONE: 'milestone',
};

export function toCompetitionGoalDatabaseType(
    type: CompetitionGoalApiType,
): CompetitionGoalDatabaseType {
    return API_TO_DATABASE_TYPE[type];
}

export function toCompetitionGoalApiType(
    type: CompetitionGoalDatabaseType,
): CompetitionGoalApiType {
    return DATABASE_TO_API_TYPE[type];
}

export interface CompetitionGoalRecord {
    id: string;
    type: CompetitionGoalDatabaseType;
    title: string;
    details: string | null;
    targetDate: Date | null;
    isActive: boolean;
    archivedAt: Date | null;
    revision: number;
    createdAt: Date;
    updatedAt: Date;
}

export function serializeCompetitionGoal(goal: CompetitionGoalRecord) {
    return {
        id: goal.id,
        type: toCompetitionGoalApiType(goal.type),
        title: goal.title,
        details: goal.details,
        targetDate: goal.targetDate ? formatJSTDate(goal.targetDate) : null,
        isActive: goal.isActive,
        archivedAt: goal.archivedAt?.toISOString() ?? null,
        revision: goal.revision,
        createdAt: goal.createdAt.toISOString(),
        updatedAt: goal.updatedAt.toISOString(),
    };
}
