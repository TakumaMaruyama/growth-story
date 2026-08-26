import { formatJSTDate, formatJSTDisplay } from './date';

export type MemberLatestUpdateKind = 'daily' | 'goal' | 'story';

export interface MemberLatestUpdate {
    kind: MemberLatestUpdateKind;
    updatedAt: Date;
    itemLabel: string;
    href: string;
}

interface DailyLogUpdate {
    logDate: Date;
    updatedAt: Date;
}

interface CompetitionGoalUpdate {
    id: string;
    type: 'NEXT_MEET' | 'ANNUAL' | 'MILESTONE';
    updatedAt: Date;
}

interface StoryVersionUpdate {
    id: string;
    version: number;
    createdAt: Date;
}

export interface MemberLatestUpdateInput {
    dailyLog: DailyLogUpdate | null;
    competitionGoal: CompetitionGoalUpdate | null;
    storyVersion: StoryVersionUpdate | null;
}

const GOAL_TYPE_LABELS: Record<CompetitionGoalUpdate['type'], string> = {
    NEXT_MEET: '大会',
    ANNUAL: '年間',
    MILESTONE: '出場目標',
};

/** 会員が更新した3つの主要記録から、最も新しい1件と管理画面へのリンクを返す。 */
export function getMemberLatestUpdate(
    userId: string,
    input: MemberLatestUpdateInput,
): MemberLatestUpdate | null {
    const encodedUserId = encodeURIComponent(userId);
    const candidates: MemberLatestUpdate[] = [];

    if (input.dailyLog) {
        const date = formatJSTDate(input.dailyLog.logDate);
        candidates.push({
            kind: 'daily',
            updatedAt: input.dailyLog.updatedAt,
            itemLabel: `練習日誌（${formatJSTDisplay(input.dailyLog.logDate)}）`,
            href: `/admin/users/${encodedUserId}/daily/${date}`,
        });
    }

    if (input.competitionGoal) {
        candidates.push({
            kind: 'goal',
            updatedAt: input.competitionGoal.updatedAt,
            itemLabel: `大会目標（${GOAL_TYPE_LABELS[input.competitionGoal.type]}）`,
            href: `/admin/users/${encodedUserId}/goals#goal-${encodeURIComponent(input.competitionGoal.id)}`,
        });
    }

    if (input.storyVersion) {
        candidates.push({
            kind: 'story',
            updatedAt: input.storyVersion.createdAt,
            itemLabel: `競泳物語（Ver.${input.storyVersion.version}）`,
            href: `/admin/users/${encodedUserId}/story/${encodeURIComponent(input.storyVersion.id)}`,
        });
    }

    return candidates.reduce<MemberLatestUpdate | null>((latest, candidate) => {
        if (!latest || candidate.updatedAt.getTime() > latest.updatedAt.getTime()) {
            return candidate;
        }
        return latest;
    }, null);
}
