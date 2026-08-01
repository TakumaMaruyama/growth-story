import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export class DailyLogConflictError extends Error {
    constructor() {
        super('Daily log version conflict');
    }
}

export interface DailyLogSaveInput {
    userId: string;
    logDate: Date;
    baseRevision: number | null;
    score: number;
    practiced: boolean;
    goodText: string | null;
    improveText: string | null;
    tomorrowText: string | null;
}

export async function countEligibleDailyLogs(
    userId: string,
    throughDate: Date,
): Promise<number> {
    return prisma.dailyLog.count({
        where: {
            userId,
            logDate: { lte: throughDate },
        },
    });
}

export async function saveDailyLog(input: DailyLogSaveInput): Promise<{ revision: number }> {
    const {
        userId,
        logDate,
        baseRevision,
        score,
        practiced,
        goodText,
        improveText,
        tomorrowText,
    } = input;
    const values = { score, practiced, goodText, improveText, tomorrowText };

    if (baseRevision !== null) {
        const updated = await prisma.dailyLog.updateManyAndReturn({
            where: { userId, logDate, revision: baseRevision },
            data: { ...values, revision: { increment: 1 } },
            select: { revision: true },
        });
        if (updated.length !== 1 || !updated[0]) throw new DailyLogConflictError();
        return updated[0];
    }

    try {
        return await prisma.dailyLog.create({
            data: { userId, logDate, ...values },
            select: { revision: true },
        });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002'
        ) {
            throw new DailyLogConflictError();
        }
        throw error;
    }
}
