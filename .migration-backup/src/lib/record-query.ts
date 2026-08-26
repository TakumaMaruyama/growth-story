import type { DailyActivityType } from './daily-activity';
import { prisma } from './prisma';
import { MAX_RECORD_PAGE, type RecordItemType, type RecordTypeFilter } from './records';

export interface DailyRecordRow {
    id: string;
    logDate: Date;
    score: number;
    activityType: DailyActivityType;
}

export interface StoryRecordRow {
    id: string;
    version: number;
    note: string | null;
    createdAt: Date;
}

export interface GoalRecordRow {
    id: string;
    type: 'NEXT_MEET' | 'ANNUAL' | 'MILESTONE';
    title: string;
    details: string | null;
    targetDate: Date | null;
    isActive: boolean;
    archivedAt: Date | null;
    updatedAt: Date;
}

export interface RecordListRow {
    recordId: string;
    itemType: RecordItemType;
    dateKey: string | null;
    sortTime: Date | null;
    version: number | null;
    note: string | null;
    score: number | null;
    activityType: string | null;
    goalType: string | null;
    title: string | null;
    details: string | null;
    targetDate: Date | null;
    isActive: boolean | null;
    archivedAt: Date | null;
    updatedAt: Date | null;
}

interface CalendarQueryRange {
    dateStart: Date;
    dateEnd: Date;
    instantStart: Date;
    instantEnd: Date;
}

function includesType(filter: RecordTypeFilter, type: RecordItemType): boolean {
    return filter === 'all' || filter === type;
}

export async function loadRecordCalendarRows(
    userId: string,
    type: RecordTypeFilter,
    range: CalendarQueryRange,
): Promise<{
    dailyLogs: DailyRecordRow[];
    goals: GoalRecordRow[];
    stories: StoryRecordRow[];
    undatedGoalCount: number;
}> {
    const [dailyLogs, goals, stories, undatedGoalCount] = await Promise.all([
        includesType(type, 'daily')
            ? prisma.dailyLog.findMany({
                where: { userId, logDate: { gte: range.dateStart, lt: range.dateEnd } },
                orderBy: { logDate: 'desc' },
                select: { id: true, logDate: true, score: true, activityType: true },
            })
            : Promise.resolve([] as DailyRecordRow[]),
        includesType(type, 'goal')
            ? prisma.competitionGoal.findMany({
                where: { userId, targetDate: { gte: range.dateStart, lt: range.dateEnd } },
                orderBy: [{ targetDate: 'desc' }, { updatedAt: 'desc' }],
                select: {
                    id: true,
                    type: true,
                    title: true,
                    details: true,
                    targetDate: true,
                    isActive: true,
                    archivedAt: true,
                    updatedAt: true,
                },
            })
            : Promise.resolve([] as GoalRecordRow[]),
        includesType(type, 'story')
            ? prisma.storyVersion.findMany({
                where: { userId, createdAt: { gte: range.instantStart, lt: range.instantEnd } },
                orderBy: { createdAt: 'desc' },
                select: { id: true, version: true, note: true, createdAt: true },
            })
            : Promise.resolve([] as StoryRecordRow[]),
        includesType(type, 'goal')
            ? prisma.competitionGoal.count({ where: { userId, targetDate: null } })
            : Promise.resolve(0),
    ]);

    return { dailyLogs, goals, stories, undatedGoalCount };
}

export async function loadRecordListPageRows(
    userId: string,
    type: RecordTypeFilter,
    page: number,
    pageSize: number,
): Promise<{ rows: RecordListRow[]; totalItems: number }> {
    if (!Number.isSafeInteger(page) || page < 1 || page > MAX_RECORD_PAGE) {
        throw new Error('Invalid record page');
    }
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new Error('Invalid record page size');
    }
    const offset = (page - 1) * pageSize;
    const [dailyCount, goalCount, storyCount, rows] = await Promise.all([
        includesType(type, 'daily') ? prisma.dailyLog.count({ where: { userId } }) : Promise.resolve(0),
        includesType(type, 'goal') ? prisma.competitionGoal.count({ where: { userId } }) : Promise.resolve(0),
        includesType(type, 'story') ? prisma.storyVersion.count({ where: { userId } }) : Promise.resolve(0),
        prisma.$queryRaw<RecordListRow[]>`
            SELECT *
            FROM (
                SELECT
                    "id" AS "recordId",
                    'daily'::text AS "itemType",
                    to_char("log_date", 'YYYY-MM-DD') AS "dateKey",
                    NULL::timestamp AS "sortTime",
                    NULL::integer AS "version",
                    NULL::text AS "note",
                    "score",
                    "activity_type"::text AS "activityType",
                    NULL::text AS "goalType",
                    NULL::text AS "title",
                    NULL::text AS "details",
                    NULL::date AS "targetDate",
                    NULL::boolean AS "isActive",
                    NULL::timestamp AS "archivedAt",
                    NULL::timestamp AS "updatedAt"
                FROM "daily_logs"
                WHERE "user_id" = ${userId} AND ${type}::text IN ('all', 'daily')

                UNION ALL

                SELECT
                    "id" AS "recordId",
                    'goal'::text AS "itemType",
                    to_char("target_date", 'YYYY-MM-DD') AS "dateKey",
                    "updated_at" AS "sortTime",
                    NULL::integer AS "version",
                    NULL::text AS "note",
                    NULL::integer AS "score",
                    NULL::text AS "activityType",
                    "goal_type"::text AS "goalType",
                    "title",
                    "details",
                    "target_date" AS "targetDate",
                    "is_active" AS "isActive",
                    "archived_at" AS "archivedAt",
                    "updated_at" AS "updatedAt"
                FROM "competition_goals"
                WHERE "user_id" = ${userId} AND ${type}::text IN ('all', 'goal')

                UNION ALL

                SELECT
                    "id" AS "recordId",
                    'story'::text AS "itemType",
                    to_char(
                        "created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo',
                        'YYYY-MM-DD'
                    ) AS "dateKey",
                    "created_at" AS "sortTime",
                    "version",
                    "note",
                    NULL::integer AS "score",
                    NULL::text AS "activityType",
                    NULL::text AS "goalType",
                    NULL::text AS "title",
                    NULL::text AS "details",
                    NULL::date AS "targetDate",
                    NULL::boolean AS "isActive",
                    NULL::timestamp AS "archivedAt",
                    NULL::timestamp AS "updatedAt"
                FROM "story_versions"
                WHERE "user_id" = ${userId} AND ${type}::text IN ('all', 'story')
            ) AS "records"
            ORDER BY
                ("dateKey" IS NULL) DESC,
                "dateKey" DESC,
                CASE "itemType" WHEN 'daily' THEN 0 WHEN 'goal' THEN 1 ELSE 2 END,
                "sortTime" DESC NULLS LAST,
                "recordId" ASC
            LIMIT ${pageSize}
            OFFSET ${offset}
        `,
    ]);

    return { rows, totalItems: dailyCount + goalCount + storyCount };
}
