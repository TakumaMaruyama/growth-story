export const DAILY_LOG_BADGE_MILESTONES = Object.freeze([
    1,
    3,
    7,
    10,
    25,
    50,
    100,
    200,
] as const);

export type DailyLogBadgeMilestone = typeof DAILY_LOG_BADGE_MILESTONES[number];

export interface DailyLogBadgeProgress {
    recordCount: number;
    earnedMilestones: DailyLogBadgeMilestone[];
    latestMilestone: DailyLogBadgeMilestone | null;
    nextMilestone: DailyLogBadgeMilestone | null;
    remaining: number | null;
    /** Progress from the latest earned milestone to the next one, from 0 to 1. */
    progress: number;
}

function assertRecordCount(recordCount: number): void {
    if (!Number.isSafeInteger(recordCount) || recordCount < 0) {
        throw new RangeError('recordCount must be a non-negative safe integer');
    }
}

export function isDailyLogBadgeMilestone(
    recordCount: number,
): recordCount is DailyLogBadgeMilestone {
    return (DAILY_LOG_BADGE_MILESTONES as readonly number[]).includes(recordCount);
}

export function getDailyLogBadgeProgress(recordCount: number): DailyLogBadgeProgress {
    assertRecordCount(recordCount);

    const earnedMilestones = DAILY_LOG_BADGE_MILESTONES.filter(
        (milestone) => milestone <= recordCount,
    );
    const latestMilestone = earnedMilestones.at(-1) ?? null;
    const nextMilestone = DAILY_LOG_BADGE_MILESTONES.find(
        (milestone) => milestone > recordCount,
    ) ?? null;

    if (nextMilestone === null) {
        return {
            recordCount,
            earnedMilestones: [...earnedMilestones],
            latestMilestone,
            nextMilestone: null,
            remaining: null,
            progress: 1,
        };
    }

    const progressStart = latestMilestone ?? 0;
    return {
        recordCount,
        earnedMilestones: [...earnedMilestones],
        latestMilestone,
        nextMilestone,
        remaining: nextMilestone - recordCount,
        progress: (recordCount - progressStart) / (nextMilestone - progressStart),
    };
}

export function getNewlyEarnedDailyLogBadges(
    previousRecordCount: number,
    currentRecordCount: number,
): DailyLogBadgeMilestone[] {
    assertRecordCount(previousRecordCount);
    assertRecordCount(currentRecordCount);

    if (currentRecordCount <= previousRecordCount) return [];
    return DAILY_LOG_BADGE_MILESTONES.filter(
        (milestone) => milestone > previousRecordCount && milestone <= currentRecordCount,
    );
}
