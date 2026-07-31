import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { createSession } from '../lib/auth';
import { DailyLogConflictError, saveDailyLog } from '../lib/daily-log-service';
import { prisma } from '../lib/prisma';
import { consumeRateLimits } from '../lib/rate-limit';
import { hashSessionToken } from '../lib/session-token';
import { saveStoryVersion, StoryVersionConflictError } from '../lib/story-service';

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

test('security database invariants', async (context) => {
    await context.test('parallel rate-limit requests cannot exceed the limit', async () => {
        const namespace = `integration-${randomUUID()}`;
        const identifier = randomUUID();
        const rule = { namespace, identifier, maxAttempts: 5, windowMs: 60_000 };
        const results = await Promise.all(
            Array.from({ length: 20 }, () => consumeRateLimits([rule])),
        );

        assert.equal(results.filter((result) => result.allowed).length, rule.maxAttempts);
        assert.equal(results.filter((result) => !result.allowed).length, 15);

        const keyHash = createHash('sha256')
            .update(`${namespace}\0${identifier}`)
            .digest('hex');
        await prisma.rateLimitEvent.deleteMany({ where: { keyHash } });
    });

    await context.test('rate-limit consumption removes globally expired events', async () => {
        const expired = await prisma.rateLimitEvent.create({
            data: {
                keyHash: createHash('sha256').update(randomUUID()).digest('hex'),
                createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
            },
            select: { id: true },
        });
        const namespace = `integration-cleanup-${randomUUID()}`;
        const identifier = randomUUID();
        await consumeRateLimits([{ namespace, identifier, maxAttempts: 1, windowMs: 60_000 }]);

        assert.equal(await prisma.rateLimitEvent.count({ where: { id: expired.id } }), 0);
        const keyHash = createHash('sha256')
            .update(`${namespace}\0${identifier}`)
            .digest('hex');
        await prisma.rateLimitEvent.deleteMany({ where: { keyHash } });
    });

    await context.test('session creation stores hashes and caps active sessions', async () => {
        const user = await prisma.user.create({
            data: {
                loginId: `integration_${randomUUID()}`,
                displayName: 'Integration test',
                passwordHash: 'not-used-by-this-test',
            },
            select: { id: true },
        });

        try {
            const tokens = await Promise.all(
                Array.from({ length: 12 }, () => createSession(user.id)),
            );
            const sessions = await prisma.session.findMany({
                where: { userId: user.id },
                select: { tokenHash: true },
            });

            assert.equal(sessions.length, 5);
            const expectedHashes = new Set(tokens.map(hashSessionToken));
            const storedHashes = new Set(sessions.map((session) => session.tokenHash));
            assert.equal(storedHashes.size, sessions.length);
            for (const session of sessions) {
                assert.match(session.tokenHash, /^[a-f0-9]{64}$/);
                assert.equal(expectedHashes.has(session.tokenHash), true);
            }
        } finally {
            await prisma.user.delete({ where: { id: user.id } });
        }
    });

    await context.test('concurrent daily-log CAS writes allow exactly one update', async () => {
        const user = await prisma.user.create({
            data: {
                loginId: `integration_${randomUUID()}`,
                displayName: 'Daily log concurrency test',
                passwordHash: 'not-used-by-this-test',
            },
            select: { id: true },
        });
        const logDate = new Date('2026-01-15T00:00:00.000Z');

        try {
            await saveDailyLog({
                userId: user.id,
                logDate,
                baseRevision: null,
                score: 5,
                practiced: true,
                goodText: 'Initial entry',
                improveText: null,
                tomorrowText: null,
            });

            const writes = [
                {
                    score: 8,
                    goodText: 'Concurrent write A',
                    tomorrowText: 'Follow-up A',
                },
                {
                    score: 9,
                    goodText: 'Concurrent write B',
                    tomorrowText: 'Follow-up B',
                },
            ] as const;
            const results = await Promise.allSettled(
                writes.map((write) => saveDailyLog({
                    userId: user.id,
                    logDate,
                    baseRevision: 1,
                    score: write.score,
                    practiced: true,
                    goodText: write.goodText,
                    improveText: null,
                    tomorrowText: write.tomorrowText,
                })),
            );

            assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
            assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
            const success = results.find((result) => result.status === 'fulfilled');
            assert.ok(success && success.status === 'fulfilled');
            assert.deepEqual(success.value, { revision: 2 });
            const rejection = results.find((result) => result.status === 'rejected');
            assert.ok(rejection && rejection.status === 'rejected');
            assert.ok(rejection.reason instanceof DailyLogConflictError);

            const storedLog = await prisma.dailyLog.findUnique({
                where: { userId_logDate: { userId: user.id, logDate } },
                select: { revision: true, score: true, goodText: true, tomorrowText: true },
            });
            assert.ok(storedLog);
            assert.equal(await prisma.dailyLog.count({ where: { userId: user.id } }), 1);
            assert.equal(storedLog.revision, 2);
            const winningWrite = writes.find((write) => write.score === storedLog.score);
            assert.ok(winningWrite);
            assert.equal(storedLog.goodText, winningWrite.goodText);
            assert.equal(storedLog.tomorrowText, winningWrite.tomorrowText);
        } finally {
            await prisma.user.delete({ where: { id: user.id } });
        }
    });

    await context.test('concurrent story creation allows exactly one first version', async () => {
        const user = await prisma.user.create({
            data: {
                loginId: `integration_${randomUUID()}`,
                displayName: 'Story concurrency test',
                passwordHash: 'not-used-by-this-test',
            },
            select: { id: true },
        });

        try {
            const writes = [
                {
                    baseVersion: null,
                    answers: [{ questionNo: 1, answerText: 'Concurrent story A' }],
                    note: 'Story note A',
                },
                {
                    baseVersion: null,
                    answers: [{ questionNo: 1, answerText: 'Concurrent story B' }],
                    note: 'Story note B',
                },
            ] as const;
            const results = await Promise.allSettled(
                writes.map((write) => saveStoryVersion(user.id, {
                    baseVersion: write.baseVersion,
                    answers: [...write.answers],
                    note: write.note,
                })),
            );

            assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
            assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
            const success = results.find((result) => result.status === 'fulfilled');
            assert.ok(success && success.status === 'fulfilled');
            assert.deepEqual(success.value, { version: 1, unchanged: false });
            const rejection = results.find((result) => result.status === 'rejected');
            assert.ok(rejection && rejection.status === 'rejected');
            assert.ok(rejection.reason instanceof StoryVersionConflictError);
            assert.equal(rejection.reason.currentVersion, 1);

            const storedVersions = await prisma.storyVersion.findMany({
                where: { userId: user.id },
                include: {
                    answers: {
                        orderBy: { questionNo: 'asc' },
                        select: { questionNo: true, answerText: true },
                    },
                },
            });
            assert.equal(storedVersions.length, 1);
            const storedVersion = storedVersions[0];
            assert.ok(storedVersion);
            assert.equal(storedVersion.version, 1);
            assert.equal(storedVersion.answers.length, 1);
            const storedAnswer = storedVersion.answers[0];
            assert.ok(storedAnswer);
            assert.equal(storedAnswer.questionNo, 1);
            const winningWrite = writes.find(
                (write) => write.answers[0]?.answerText === storedAnswer.answerText,
            );
            assert.ok(winningWrite);
            assert.equal(storedVersion.note, winningWrite.note);
        } finally {
            await prisma.user.delete({ where: { id: user.id } });
        }
    });
});

test.after(async () => {
    await prisma.$disconnect();
});
