export const DAILY_LOG_BADGE_DEFINITIONS = Object.freeze([
    { milestone: 1, name: 'はじまり', color: '#0284c7', swatch: 'linear-gradient(135deg, #38bdf8, #0284c7)', foreground: '#ffffff' },
    { milestone: 3, name: 'アクア', color: '#0891b2', swatch: 'linear-gradient(135deg, #67e8f9, #0891b2)', foreground: '#083344' },
    { milestone: 7, name: 'オーシャン', color: '#2563eb', swatch: 'linear-gradient(135deg, #60a5fa, #1d4ed8)', foreground: '#ffffff' },
    { milestone: 10, name: 'インディゴ', color: '#4f46e5', swatch: 'linear-gradient(135deg, #818cf8, #4338ca)', foreground: '#ffffff' },
    { milestone: 25, name: 'バイオレット', color: '#7c3aed', swatch: 'linear-gradient(135deg, #c084fc, #6d28d9)', foreground: '#ffffff' },
    { milestone: 50, name: 'ローズ', color: '#db2777', swatch: 'linear-gradient(135deg, #f9a8d4, #be185d)', foreground: '#ffffff' },
    { milestone: 100, name: 'ルビー', color: '#be123c', swatch: 'linear-gradient(135deg, #fb7185, #be123c)', foreground: '#ffffff' },
    { milestone: 200, name: 'サンセット', color: '#ea580c', swatch: 'linear-gradient(135deg, #fb923c, #dc2626)', foreground: '#ffffff' },
    { milestone: 365, name: 'ゴールド', color: '#b45309', swatch: 'linear-gradient(135deg, #fde047, #d97706)', foreground: '#422006' },
    { milestone: 500, name: 'ライム', color: '#4d7c0f', swatch: 'linear-gradient(135deg, #bef264, #4d7c0f)', foreground: '#1a2e05' },
    { milestone: 730, name: 'エメラルド', color: '#15803d', swatch: 'linear-gradient(135deg, #6ee7b7, #15803d)', foreground: '#052e16' },
    { milestone: 1000, name: 'ティール', color: '#0f766e', swatch: 'linear-gradient(135deg, #5eead4, #0f766e)', foreground: '#042f2e' },
    { milestone: 1500, name: 'サファイア', color: '#1d4ed8', swatch: 'linear-gradient(135deg, #22d3ee, #1d4ed8)', foreground: '#ffffff' },
    { milestone: 2000, name: 'アメジスト', color: '#6d28d9', swatch: 'linear-gradient(135deg, #a78bfa, #6d28d9)', foreground: '#ffffff' },
    { milestone: 2500, name: 'ブロンズ', color: '#92400e', swatch: 'linear-gradient(135deg, #d97706, #78350f)', foreground: '#ffffff' },
    { milestone: 3000, name: 'シルバー', color: '#475569', swatch: 'linear-gradient(135deg, #f1f5f9, #64748b)', foreground: '#0f172a' },
    { milestone: 3650, name: 'プレミアムゴールド', color: '#a16207', swatch: 'linear-gradient(135deg, #fef08a, #ca8a04, #854d0e)', foreground: '#422006' },
    { milestone: 5000, name: 'オーロラ', color: '#0f766e', swatch: 'linear-gradient(135deg, #22d3ee, #34d399, #a78bfa, #f472b6)', foreground: '#0f172a' },
    { milestone: 7300, name: 'レインボー', color: '#7c3aed', swatch: 'linear-gradient(135deg, #ef4444, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef)', foreground: '#ffffff' },
    { milestone: 10000, name: 'レジェンド', color: '#111827', swatch: 'linear-gradient(135deg, #111827, #7c3aed, #f59e0b, #fef3c7)', foreground: '#ffffff' },
] as const);

export type DailyLogBadgeDefinition = typeof DAILY_LOG_BADGE_DEFINITIONS[number];
export type DailyLogBadgeMilestone = DailyLogBadgeDefinition['milestone'];

export const DAILY_LOG_BADGE_MILESTONES: readonly DailyLogBadgeMilestone[] = Object.freeze(
    DAILY_LOG_BADGE_DEFINITIONS.map((definition) => definition.milestone),
);

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

export function getDailyLogBadgeDefinition(
    milestone: DailyLogBadgeMilestone,
): DailyLogBadgeDefinition {
    const definition = DAILY_LOG_BADGE_DEFINITIONS.find(
        (candidate) => candidate.milestone === milestone,
    );
    if (!definition) throw new RangeError('Unknown daily-log badge milestone');
    return definition;
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
