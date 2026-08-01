import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    archiveCompetitionGoal,
    CompetitionGoalLimitError,
    CompetitionGoalNotFoundError,
    CompetitionGoalSingletonConflictError,
    CompetitionGoalVersionConflictError,
    createCompetitionGoal,
    deleteArchivedCompetitionGoal,
    listCompetitionGoals,
    updateCompetitionGoal,
} from '../lib/competition-goal-service';
import {
    MAX_ACTIVE_MILESTONE_GOALS,
    MAX_COMPETITION_GOALS_PER_USER,
} from '../lib/limits';
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
        await context.test('concurrent singleton creation allows only one active goal', async () => {
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
            assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
            const rejection = attempts.find((result) => result.status === 'rejected');
            assert.ok(rejection && rejection.status === 'rejected');
            assert.ok(rejection.reason instanceof CompetitionGoalSingletonConflictError);
        });

        await context.test('archive preserves history and permits the next singleton goal', async () => {
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

        await context.test('annual goals retain their target year after archiving', async () => {
            const annual = await createCompetitionGoal(owner.id, {
                type: 'ANNUAL',
                title: 'Annual target',
                details: null,
                targetDate: new Date('2026-12-31T00:00:00.000Z'),
            });
            await assert.rejects(
                createCompetitionGoal(owner.id, {
                    type: 'ANNUAL',
                    title: 'Duplicate annual target',
                    details: null,
                    targetDate: new Date('2026-12-31T00:00:00.000Z'),
                }),
                CompetitionGoalSingletonConflictError,
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

        await context.test('concurrent milestones cannot exceed the active limit', async () => {
            const attempts = await Promise.allSettled(
                Array.from({ length: MAX_ACTIVE_MILESTONE_GOALS + 5 }, (_, index) => (
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
                MAX_ACTIVE_MILESTONE_GOALS,
            );
            const rejections = attempts.filter((result) => result.status === 'rejected');
            assert.equal(rejections.length, 5);
            assert.equal(
                rejections.every((result) => result.reason instanceof CompetitionGoalLimitError),
                true,
            );
        });

        await context.test('total history limit prevents unbounded archived goals', async () => {
            const existingCount = await prisma.competitionGoal.count({
                where: { userId: owner.id },
            });
            await prisma.competitionGoal.createMany({
                data: Array.from(
                    { length: MAX_COMPETITION_GOALS_PER_USER - existingCount },
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

            await assert.rejects(
                createCompetitionGoal(owner.id, {
                    type: 'MILESTONE',
                    title: 'One goal too many',
                    details: null,
                    targetDate: new Date('2029-12-31T00:00:00.000Z'),
                }),
                (error: unknown) => error instanceof CompetitionGoalLimitError
                    && error.kind === 'total',
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

            const annualAfterCleanup = await createCompetitionGoal(owner.id, {
                type: 'ANNUAL',
                title: 'Annual goal after history cleanup',
                details: null,
                targetDate: new Date('2030-12-31T00:00:00.000Z'),
            });
            assert.equal(annualAfterCleanup.type, 'ANNUAL');
        });
    } finally {
        await prisma.user.deleteMany({ where: { id: { in: [owner.id, otherUser.id] } } });
    }
});

test.after(async () => {
    await prisma.$disconnect();
});
