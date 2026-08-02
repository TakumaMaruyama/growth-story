import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { MAX_STORY_VERSIONS } from './limits';
import type { StoryInput } from './validation';
import { assertMemberWritableInTransaction } from './member-access';

export class StoryLimitError extends Error {}

export class StoryVersionConflictError extends Error {
    constructor(readonly currentVersion: number | null) {
        super('Story version conflict');
    }
}

function storiesMatch(
    current: { note: string | null; answers: Array<{ questionNo: number; answerText: string }> },
    next: StoryInput,
): boolean {
    if ((current.note ?? null) !== next.note || current.answers.length !== next.answers.length) {
        return false;
    }
    const currentAnswers = new Map(current.answers.map((answer) => [answer.questionNo, answer.answerText]));
    return next.answers.every((answer) => currentAnswers.get(answer.questionNo) === answer.answerText);
}

export async function saveStoryVersion(userId: string, input: StoryInput) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await prisma.$transaction(async (tx) => {
                await assertMemberWritableInTransaction(tx, userId);
                const [versionCount, latestVersion] = await Promise.all([
                    tx.storyVersion.count({ where: { userId } }),
                    tx.storyVersion.findFirst({
                        where: { userId },
                        orderBy: { version: 'desc' },
                        include: {
                            answers: {
                                orderBy: { questionNo: 'asc' },
                                select: { questionNo: true, answerText: true },
                            },
                        },
                    }),
                ]);

                const currentVersion = latestVersion?.version ?? null;
                if (currentVersion !== input.baseVersion) {
                    throw new StoryVersionConflictError(currentVersion);
                }

                if (latestVersion && storiesMatch(latestVersion, input)) {
                    return { version: latestVersion.version, unchanged: true };
                }
                if (
                    versionCount >= MAX_STORY_VERSIONS
                    || (latestVersion?.version ?? 0) >= MAX_STORY_VERSIONS
                ) {
                    throw new StoryLimitError();
                }

                const version = (latestVersion?.version ?? 0) + 1;
                await tx.storyVersion.create({
                    data: {
                        userId,
                        version,
                        note: input.note,
                        answers: { create: input.answers },
                    },
                });
                return { version, unchanged: false };
            // The per-user advisory lock serializes story writes. READ COMMITTED
            // also guarantees that, after waiting for a concurrent withdrawal,
            // the membership check sees the newly committed read-only state.
            }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
        } catch (error) {
            const isRetryable = error instanceof Prisma.PrismaClientKnownRequestError
                && (error.code === 'P2002' || error.code === 'P2034');
            if (!isRetryable || attempt === 2) throw error;
        }
    }

    throw new Error('Story save retry exhausted');
}
