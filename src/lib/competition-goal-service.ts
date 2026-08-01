import { Prisma, type CompetitionGoalType } from '@prisma/client';
import { prisma } from './prisma';
import {
    MAX_ACTIVE_MILESTONE_GOALS,
    MAX_COMPETITION_GOALS_PER_USER,
} from './limits';
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

export class CompetitionGoalSingletonConflictError extends Error {
    constructor(readonly type: CompetitionGoalType) {
        super('An active singleton competition goal already exists');
    }
}

export class CompetitionGoalLimitError extends Error {
    constructor(readonly kind: 'active_milestone' | 'total') {
        super(kind === 'active_milestone'
            ? 'Active milestone competition goal limit reached'
            : 'Competition goal history limit reached');
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
                // Serializes writes per user so both the singleton rule and the
                // active-milestone count remain correct under concurrent requests.
                await tx.$queryRaw`
                    SELECT pg_advisory_xact_lock(
                        hashtextextended(${`competition-goals:${userId}`}, 0)
                    )::text AS lock_result
                `;
                return operation(tx);
            // READ COMMITTED intentionally takes a fresh snapshot after a
            // concurrent writer releases the advisory lock. A transaction-wide
            // serializable snapshot could be established while waiting and miss
            // the just-committed active-goal count.
            }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
        } catch (error) {
            const retryable = error instanceof Prisma.PrismaClientKnownRequestError
                && error.code === 'P2034';
            if (!retryable || attempt === 2) throw error;
        }
    }
    throw new Error('Competition goal write retry exhausted');
}

async function assertCanActivate(
    tx: Prisma.TransactionClient,
    userId: string,
    type: CompetitionGoalType,
    excludingId?: string,
): Promise<void> {
    if (type === 'MILESTONE') {
        const count = await tx.competitionGoal.count({
            where: {
                userId,
                type,
                isActive: true,
                ...(excludingId ? { id: { not: excludingId } } : {}),
            },
        });
        if (count >= MAX_ACTIVE_MILESTONE_GOALS) {
            throw new CompetitionGoalLimitError('active_milestone');
        }
        return;
    }

    const current = await tx.competitionGoal.findFirst({
        where: {
            userId,
            type,
            isActive: true,
            ...(excludingId ? { id: { not: excludingId } } : {}),
        },
        select: { id: true },
    });
    if (current) throw new CompetitionGoalSingletonConflictError(type);
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
    try {
        return await withUserGoalWrite(userId, async (tx) => {
            const totalCount = await tx.competitionGoal.count({ where: { userId } });
            if (totalCount >= MAX_COMPETITION_GOALS_PER_USER) {
                throw new CompetitionGoalLimitError('total');
            }
            await assertCanActivate(tx, userId, input.type);
            return tx.competitionGoal.create({
                data: { userId, ...input },
                select: GOAL_SELECT,
            });
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new CompetitionGoalSingletonConflictError(input.type);
        }
        throw error;
    }
}

export async function updateCompetitionGoal(
    userId: string,
    goalId: string,
    input: CompetitionGoalUpdateInput,
) {
    let conflictType: CompetitionGoalType = 'NEXT_MEET';
    try {
        return await withUserGoalWrite(userId, async (tx) => {
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
            conflictType = current.type;
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

            const nextIsActive = input.isActive ?? current.isActive;
            if (nextIsActive && !current.isActive) {
                await assertCanActivate(tx, userId, current.type, goalId);
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
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new CompetitionGoalSingletonConflictError(conflictType);
        }
        throw error;
    }
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
