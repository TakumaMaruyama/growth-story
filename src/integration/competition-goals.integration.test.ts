import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    archiveCompetitionGoal,
    CompetitionGoalNotFoundError,
    CompetitionGoalVersionConflictError,
    createCompetitionGoal,
    deleteArchivedCompetitionGoal,
    listCompetitionGoals,
    updateCompetitionGoal,
} from '../lib/competition-goal-service';
import { prisma } from '../lib/prisma';

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

test('competition goal database invariants', async (context) => {
    const owner = await prisma.user.create({
        data: {
            loginId: `goals_owner_${randomUUID()}`,
            displayName: 'Goal owner',
            passwordHash: 'not-used-by-this-test',
        },
        select: { id: true },
    });
    const otherUser = await prisma.user.create({
        data: {
            loginId: `goals_other_${randomUUID()}`,
            displayName: 'Other user',
            passwordHash: 'not-used-by-this-test',
        },
        select: { id: true },
    });

    try {
        await context.test('concurrent meet creation allows multiple active goals', async () => {
            const attempts = await Promise.allSettled([
                createCompetitionGoal(owner.id, {
                    type: 'NEXT_MEET',
                    title: 'Concurrent next meet A',
                    details: null,
                    targetDate: null,
                }),
                createCompetitionGoal(owner.id, {
                    type: 'NEXT_MEET',
                    title: 'Concurrent next meet B',
                    details: null,
                    targetDate: null,
                }),
            ]);
            assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 2);
            assert.equal(
                await prisma.competitionGoal.count({
                    where: { userId: owner.id, type: 'NEXT_MEET', isActive: true },
                }),
                2,
            );
        });

        await context.test('archive preserves history and permits another meet goal', async () => {
            const current = await prisma.competitionGoal.findFirstOrThrow({
                where: { userId: owner.id, type: 'NEXT_MEET', isActive: true },
            });
            await archiveCompetitionGoal(owner.id, current.id, current.revision);
            const replacement = await createCompetitionGoal(owner.id, {
                type: 'NEXT_MEET',
                title: 'Replacement next meet',
                details: null,
                targetDate: null,
            });

            assert.equal(replacement.revision, 1);
            const allGoals = await listCompetitionGoals(owner.id, true);
            const past = allGoals.find((goal) => goal.id === current.id);
            assert.ok(past);
            assert.equal(past.isActive, false);
            assert.ok(past.archivedAt);
            assert.equal((await listCompetitionGoals(owner.id)).some((goal) => goal.id === current.id), false);
        });

        await context.test('concurrent annual goals remain active and retain their target year', async () => {
            const [annual] = await Promise.all([
                createCompetitionGoal(owner.id, {
                    type: 'ANNUAL',
                    title: 'Annual target A',
                    details: null,
                    targetDate: new Date('2026-12-31T00:00:00.000Z'),
                }),
                createCompetitionGoal(owner.id, {
                    type: 'ANNUAL',
                    title: 'Annual target B',
                    details: null,
                    targetDate: new Date('2027-12-31T00:00:00.000Z'),
                }),
            ]);
            assert.equal(
                await prisma.competitionGoal.count({
                    where: { userId: owner.id, type: 'ANNUAL', isActive: true },
                }),
                2,
            );

            await archiveCompetitionGoal(owner.id, annual.id, annual.revision);
            const archived = (await listCompetitionGoals(owner.id, true))
                .find((goal) => goal.id === annual.id);
            assert.ok(archived?.targetDate);
            assert.equal(archived.targetDate.toISOString().slice(0, 10), '2026-12-31');
        });

        await context.test('CAS and ownership prevent lost or cross-account updates', async () => {
            const current = await prisma.competitionGoal.findFirstOrThrow({
                where: { userId: owner.id, type: 'NEXT_MEET', isActive: true },
            });
            const updates = await Promise.allSettled([
                updateCompetitionGoal(owner.id, current.id, {
                    baseRevision: current.revision,
                    title: 'CAS winner A',
                }),
                updateCompetitionGoal(owner.id, current.id, {
                    baseRevision: current.revision,
                    title: 'CAS winner B',
                }),
            ]);
            assert.equal(updates.filter((result) => result.status === 'fulfilled').length, 1);
            const rejection = updates.find((result) => result.status === 'rejected');
            assert.ok(rejection && rejection.status === 'rejected');
            assert.ok(rejection.reason instanceof CompetitionGoalVersionConflictError);

            await assert.rejects(
                updateCompetitionGoal(otherUser.id, current.id, {
                    baseRevision: current.revision + 1,
                    title: 'Cross-account overwrite',
                }),
                CompetitionGoalNotFoundError,
            );
            await assert.rejects(
                archiveCompetitionGoal(otherUser.id, current.id, current.revision + 1),
                CompetitionGoalNotFoundError,
            );
            const archivedGoal = await prisma.competitionGoal.findFirstOrThrow({
                where: { userId: owner.id, isActive: false },
                select: { id: true, revision: true },
            });
            await assert.rejects(
                deleteArchivedCompetitionGoal(
                    otherUser.id,
                    archivedGoal.id,
                    archivedGoal.revision,
                ),
                CompetitionGoalNotFoundError,
            );
            assert.deepEqual(await listCompetitionGoals(otherUser.id), []);
        });

        await context.test('more than twenty concurrent milestones can remain active', async () => {
            const concurrentGoalCount = 25;
            const attempts = await Promise.allSettled(
                Array.from({ length: concurrentGoalCount }, (_, index) => (
                    createCompetitionGoal(owner.id, {
                        type: 'MILESTONE',
                        title: `Milestone ${index + 1}`,
                        details: null,
                        targetDate: new Date('2027-03-31T00:00:00.000Z'),
                    })
                )),
            );
            assert.equal(
                attempts.filter((result) => result.status === 'fulfilled').length,
                concurrentGoalCount,
            );
            assert.equal(
                await prisma.competitionGoal.count({
                    where: { userId: owner.id, type: 'MILESTONE', isActive: true },
                }),
                concurrentGoalCount,
            );
        });

        await context.test('goals can be added after the previous 250-record threshold', async () => {
            const previousLimit = 250;
            const existingCount = await prisma.competitionGoal.count({
                where: { userId: owner.id },
            });
            assert.ok(existingCount < previousLimit + 1);
            await prisma.competitionGoal.createMany({
                data: Array.from(
                    { length: previousLimit + 1 - existingCount },
                    (_, index) => ({
                        userId: owner.id,
                        type: 'MILESTONE' as const,
                        title: `Archived goal ${index + 1}`,
                        targetDate: new Date('2028-12-31T00:00:00.000Z'),
                        isActive: false,
                        archivedAt: new Date(),
                    }),
                ),
            });

            const goalBeyondPreviousLimit = await createCompetitionGoal(owner.id, {
                type: 'MILESTONE',
                title: 'Goal beyond the previous limit',
                details: null,
                targetDate: new Date('2029-12-31T00:00:00.000Z'),
            });
            assert.equal(goalBeyondPreviousLimit.isActive, true);
            assert.equal(
                await prisma.competitionGoal.count({ where: { userId: owner.id } }),
                previousLimit + 2,
            );

            const archivedGoal = await prisma.competitionGoal.findFirstOrThrow({
                where: { userId: owner.id, isActive: false },
                select: { id: true, revision: true },
            });
            await deleteArchivedCompetitionGoal(
                owner.id,
                archivedGoal.id,
                archivedGoal.revision,
            );
            assert.equal(
                await prisma.competitionGoal.findUnique({ where: { id: archivedGoal.id } }),
                null,
            );
        });
    } finally {
        await prisma.user.deleteMany({ where: { id: { in: [owner.id, otherUser.id] } } });
    }
});

test.after(async () => {
    await prisma.$disconnect();
});
