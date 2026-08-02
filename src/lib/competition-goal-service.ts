import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { assertMemberWritableInTransaction } from './member-access';
import type {
    CompetitionGoalCreateInput,
    CompetitionGoalUpdateInput,
} from './competition-goal-validation';

const GOAL_SELECT = {
    id: true,
    type: true,
    title: true,
    details: true,
    targetDate: true,
    isActive: true,
    archivedAt: true,
    revision: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.CompetitionGoalSelect;

export class CompetitionGoalNotFoundError extends Error {
    constructor() {
        super('Competition goal not found');
    }
}

export class CompetitionGoalVersionConflictError extends Error {
    constructor(readonly currentRevision: number) {
        super('Competition goal version conflict');
    }
}

export class CompetitionGoalInvalidInputError extends Error {}

async function withUserGoalWrite<T>(
    userId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await prisma.$transaction(async (tx) => {
                await assertMemberWritableInTransaction(tx, userId);
                // Keeps competition-goal writes ordered for each user while
                // preserving the existing compare-and-swap update behavior.
                await tx.$queryRaw`
                    SELECT pg_advisory_xact_lock(
                        hashtextextended(${`competition-goals:${userId}`}, 0)
                    )::text AS lock_result
                `;
                return operation(tx);
            // READ COMMITTED intentionally takes a fresh snapshot after a
            // concurrent writer releases the advisory lock.
            }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
        } catch (error) {
            const retryable = error instanceof Prisma.PrismaClientKnownRequestError
                && error.code === 'P2034';
            if (!retryable || attempt === 2) throw error;
        }
    }
    throw new Error('Competition goal write retry exhausted');
}

export async function listCompetitionGoals(userId: string, includeInactive = false) {
    return prisma.competitionGoal.findMany({
        where: {
            userId,
            ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: [
            { isActive: 'desc' },
            { targetDate: 'asc' },
            { updatedAt: 'desc' },
        ],
        select: GOAL_SELECT,
    });
}

export async function createCompetitionGoal(userId: string, input: CompetitionGoalCreateInput) {
    if ((input.type === 'ANNUAL' || input.type === 'MILESTONE') && !input.targetDate) {
        throw new CompetitionGoalInvalidInputError(
            input.type === 'ANNUAL' ? '対象年を入力してください' : '期限を入力してください',
        );
    }
    if (
        input.type === 'ANNUAL'
        && input.targetDate
        && (input.targetDate.getUTCMonth() !== 11 || input.targetDate.getUTCDate() !== 31)
    ) {
        throw new CompetitionGoalInvalidInputError('年間目標は対象年で入力してください');
    }
    return withUserGoalWrite(userId, async (tx) => {
        return tx.competitionGoal.create({
            data: { userId, ...input },
            select: GOAL_SELECT,
        });
    });
}

export async function updateCompetitionGoal(
    userId: string,
    goalId: string,
    input: CompetitionGoalUpdateInput,
) {
    return withUserGoalWrite(userId, async (tx) => {
        const current = await tx.competitionGoal.findFirst({
            where: { id: goalId, userId },
            select: {
                type: true,
                targetDate: true,
                isActive: true,
                revision: true,
            },
        });
        if (!current) throw new CompetitionGoalNotFoundError();
        if (current.revision !== input.baseRevision) {
            throw new CompetitionGoalVersionConflictError(current.revision);
        }

        const nextTargetDate = input.targetDate === undefined
            ? current.targetDate
            : input.targetDate;
        if ((current.type === 'ANNUAL' || current.type === 'MILESTONE') && !nextTargetDate) {
            throw new CompetitionGoalInvalidInputError(
                current.type === 'ANNUAL' ? '対象年を入力してください' : '期限を入力してください',
            );
        }
        if (
            current.type === 'ANNUAL'
            && nextTargetDate
            && (nextTargetDate.getUTCMonth() !== 11 || nextTargetDate.getUTCDate() !== 31)
        ) {
            throw new CompetitionGoalInvalidInputError('年間目標は対象年で入力してください');
        }

        const updated = await tx.competitionGoal.updateManyAndReturn({
            where: { id: goalId, userId, revision: input.baseRevision },
            data: {
                ...(input.title !== undefined ? { title: input.title } : {}),
                ...(input.details !== undefined ? { details: input.details } : {}),
                ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
                ...(input.isActive !== undefined ? {
                    isActive: input.isActive,
                    archivedAt: input.isActive ? null : new Date(),
                } : {}),
                revision: { increment: 1 },
            },
            select: GOAL_SELECT,
        });
        const goal = updated[0];
        if (!goal) {
            const latest = await tx.competitionGoal.findFirst({
                where: { id: goalId, userId },
                select: { revision: true },
            });
            if (!latest) throw new CompetitionGoalNotFoundError();
            throw new CompetitionGoalVersionConflictError(latest.revision);
        }
        return goal;
    });
}

export async function archiveCompetitionGoal(
    userId: string,
    goalId: string,
    baseRevision: number,
) {
    return withUserGoalWrite(userId, async (tx) => {
        const archived = await tx.competitionGoal.updateManyAndReturn({
            where: { id: goalId, userId, revision: baseRevision, isActive: true },
            data: {
                isActive: false,
                archivedAt: new Date(),
                revision: { increment: 1 },
            },
            select: GOAL_SELECT,
        });
        const archivedGoal = archived[0];
        if (archivedGoal) return archivedGoal;

        const latest = await tx.competitionGoal.findFirst({
            where: { id: goalId, userId },
            select: { revision: true },
        });
        if (!latest) throw new CompetitionGoalNotFoundError();
        throw new CompetitionGoalVersionConflictError(latest.revision);
    });
}

export async function deleteArchivedCompetitionGoal(
    userId: string,
    goalId: string,
    baseRevision: number,
): Promise<void> {
    await withUserGoalWrite(userId, async (tx) => {
        const deleted = await tx.competitionGoal.deleteMany({
            where: {
                id: goalId,
                userId,
                revision: baseRevision,
                isActive: false,
            },
        });
        if (deleted.count === 1) return;

        const latest = await tx.competitionGoal.findFirst({
            where: { id: goalId, userId },
            select: { revision: true },
        });
        if (!latest) throw new CompetitionGoalNotFoundError();
        throw new CompetitionGoalVersionConflictError(latest.revision);
    });
}
