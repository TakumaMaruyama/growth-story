import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { prisma } from '../lib/prisma';
import { loadRecordCalendarRows, loadRecordListPageRows } from '../lib/record-query';
import { getJSTDateTimeRange, getRecordMonthDateRange } from '../lib/records';

const integrationDatabaseUrl = process.env.DATABASE_URL;
if (
    process.env.ALLOW_INTEGRATION_DB_TESTS !== '1'
    || !integrationDatabaseUrl
    || !new URL(integrationDatabaseUrl).pathname.endsWith('_test')
) {
    throw new Error(
        'Refusing to run database integration tests without ALLOW_INTEGRATION_DB_TESTS=1 and a *_test database',
    );
}

test('record calendar and paginated list preserve ownership and JST dates', async (context) => {
    const owner = await prisma.user.create({
        data: {
            loginId: `records_owner_${randomUUID()}`,
            displayName: 'Record owner',
            passwordHash: 'not-used-by-this-test',
        },
        select: { id: true },
    });
    const otherUser = await prisma.user.create({
        data: {
            loginId: `records_other_${randomUUID()}`,
            displayName: 'Other record owner',
            passwordHash: 'not-used-by-this-test',
        },
        select: { id: true },
    });

    try {
        const ownerDailyIds = await prisma.dailyLog.createManyAndReturn({
            data: [
                {
                    userId: owner.id,
                    logDate: new Date('2026-08-01T00:00:00.000Z'),
                    score: 7,
                    activityType: 'PRACTICE',
                    practiced: true,
                },
                {
                    userId: owner.id,
                    logDate: new Date('2026-08-02T00:00:00.000Z'),
                    score: 8,
                    activityType: 'COMPETITION',
                    practiced: true,
                },
            ],
            select: { id: true },
        });
        await prisma.dailyLog.create({
            data: {
                userId: otherUser.id,
                logDate: new Date('2026-08-01T00:00:00.000Z'),
                score: 10,
                activityType: 'PRACTICE',
                practiced: true,
            },
        });

        const ownerStoryIds = await Promise.all([
            prisma.storyVersion.create({
                data: {
                    userId: owner.id,
                    version: 1,
                    note: 'JSTでは7月',
                    createdAt: new Date('2026-07-31T14:59:59.000Z'),
                },
                select: { id: true },
            }),
            prisma.storyVersion.create({
                data: {
                    userId: owner.id,
                    version: 2,
                    note: 'JSTでは8月',
                    createdAt: new Date('2026-07-31T15:00:00.000Z'),
                },
                select: { id: true },
            }),
            prisma.storyVersion.create({
                data: {
                    userId: owner.id,
                    version: 3,
                    note: 'JSTでは9月',
                    createdAt: new Date('2026-08-31T15:00:00.000Z'),
                },
                select: { id: true },
            }),
        ]);
        await prisma.storyVersion.create({
            data: {
                userId: otherUser.id,
                version: 1,
                note: '別アカウント',
                createdAt: new Date('2026-08-10T00:00:00.000Z'),
            },
        });

        const ownerGoalIds = await prisma.competitionGoal.createManyAndReturn({
            data: [
                {
                    userId: owner.id,
                    type: 'NEXT_MEET',
                    title: '8月の大会',
                    targetDate: new Date('2026-08-05T00:00:00.000Z'),
                },
                {
                    userId: owner.id,
                    type: 'MILESTONE',
                    title: '過去の8月目標',
                    targetDate: new Date('2026-08-09T00:00:00.000Z'),
                    isActive: false,
                    archivedAt: new Date('2026-08-10T00:00:00.000Z'),
                },
                {
                    userId: owner.id,
                    type: 'ANNUAL',
                    title: '日付未設定',
                    targetDate: null,
                },
            ],
            select: { id: true },
        });
        await prisma.competitionGoal.create({
            data: {
                userId: otherUser.id,
                type: 'NEXT_MEET',
                title: '別アカウントの大会',
                targetDate: new Date('2026-08-06T00:00:00.000Z'),
            },
        });

        await context.test('calendar uses JST half-open boundaries and includes archived goals', async () => {
            const monthRange = getRecordMonthDateRange('2026-08');
            const instantRange = getJSTDateTimeRange(monthRange.startKey, monthRange.endKey);
            const result = await loadRecordCalendarRows(owner.id, 'all', {
                dateStart: monthRange.start,
                dateEnd: monthRange.end,
                instantStart: instantRange.start,
                instantEnd: instantRange.end,
            });

            assert.deepEqual(
                new Set(result.dailyLogs.map((row) => row.id)),
                new Set(ownerDailyIds.map((row) => row.id)),
            );
            assert.deepEqual(
                result.stories.map((row) => row.id),
                [ownerStoryIds[1]?.id],
            );
            assert.deepEqual(
                new Set(result.goals.map((row) => row.id)),
                new Set(ownerGoalIds.slice(0, 2).map((row) => row.id)),
            );
            assert.equal(result.goals.some((row) => !row.isActive), true);
            assert.equal(result.undatedGoalCount, 1);
        });

        await context.test('list is owner-scoped, paginated, and includes undated goals first', async () => {
            const firstPage = await loadRecordListPageRows(owner.id, 'all', 1, 2);
            const secondPage = await loadRecordListPageRows(owner.id, 'all', 2, 2);

            assert.equal(firstPage.totalItems, 8);
            assert.equal(firstPage.rows.length, 2);
            assert.equal(firstPage.rows[0]?.itemType, 'goal');
            assert.equal(firstPage.rows[0]?.dateKey, null);
            assert.equal(firstPage.rows[1]?.recordId, ownerStoryIds[2]?.id);
            assert.equal(
                firstPage.rows.some((row) => secondPage.rows.some((next) => next.recordId === row.recordId)),
                false,
            );

            const goalsOnly = await loadRecordListPageRows(owner.id, 'goal', 1, 100);
            assert.equal(goalsOnly.totalItems, 3);
            assert.deepEqual(
                new Set(goalsOnly.rows.map((row) => row.recordId)),
                new Set(ownerGoalIds.map((row) => row.id)),
            );
        });
    } finally {
        await prisma.user.deleteMany({ where: { id: { in: [owner.id, otherUser.id] } } });
    }
});

test.after(async () => {
    await prisma.$disconnect();
});
