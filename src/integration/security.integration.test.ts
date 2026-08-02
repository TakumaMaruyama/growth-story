import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { createSession } from '../lib/auth';
import {
    archiveCompetitionGoal,
    createCompetitionGoal,
    deleteArchivedCompetitionGoal,
    listCompetitionGoals,
    updateCompetitionGoal,
} from '../lib/competition-goal-service';
import {
    countEligibleDailyLogs,
    DailyLogConflictError,
    saveDailyLog,
} from '../lib/daily-log-service';
import { GUARDIAN_CONSENT_NOTICE_VERSION } from '../lib/guardian-consent';
import {
    MembershipWriteBlockedError,
    setMembershipStatus,
} from '../lib/member-access';
import { prisma } from '../lib/prisma';
import { consumeRateLimits } from '../lib/rate-limit';
import {
    generateRegistrationInviteToken,
    hashRegistrationInviteToken,
} from '../lib/registration-invite';
import {
    registerInvitedUser,
    RegistrationInviteUnavailableError,
} from '../lib/registration-service';
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
                activityType: 'PRACTICE',
                goodText: 'Initial entry',
                improveText: null,
                tomorrowText: null,
            });

            const writes = [
                {
                    score: 8,
                    activityType: 'COMPETITION',
                    goodText: 'Concurrent write A',
                    tomorrowText: 'Follow-up A',
                },
                {
                    score: 9,
                    activityType: 'REST',
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
                    activityType: write.activityType,
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
                select: {
                    revision: true,
                    score: true,
                    activityType: true,
                    practiced: true,
                    goodText: true,
                    tomorrowText: true,
                },
            });
            assert.ok(storedLog);
            assert.equal(await prisma.dailyLog.count({ where: { userId: user.id } }), 1);
            assert.equal(storedLog.revision, 2);
            const winningWrite = writes.find((write) => write.score === storedLog.score);
            assert.ok(winningWrite);
            assert.equal(storedLog.activityType, winningWrite.activityType);
            assert.equal(storedLog.practiced, winningWrite.activityType !== 'REST');
            assert.equal(storedLog.goodText, winningWrite.goodText);
            assert.equal(storedLog.tomorrowText, winningWrite.tomorrowText);
        } finally {
            await prisma.user.delete({ where: { id: user.id } });
        }
    });

    await context.test('eligible daily-log count excludes future dates and does not grow on same-day edits', async () => {
        const user = await prisma.user.create({
            data: {
                loginId: `integration_${randomUUID()}`,
                displayName: 'Daily log milestone count test',
                passwordHash: 'not-used-by-this-test',
            },
            select: { id: true },
        });
        const throughDate = new Date('2026-01-15T00:00:00.000Z');
        const futureDate = new Date('2026-01-16T00:00:00.000Z');

        try {
            await saveDailyLog({
                userId: user.id,
                logDate: throughDate,
                baseRevision: null,
                score: 6,
                activityType: 'PRACTICE',
                goodText: null,
                improveText: null,
                tomorrowText: null,
            });
            await saveDailyLog({
                userId: user.id,
                logDate: futureDate,
                baseRevision: null,
                score: 7,
                activityType: 'COMPETITION',
                goodText: null,
                improveText: null,
                tomorrowText: null,
            });

            assert.equal(await countEligibleDailyLogs(user.id, throughDate), 1);

            await saveDailyLog({
                userId: user.id,
                logDate: throughDate,
                baseRevision: 1,
                score: 8,
                activityType: 'REST',
                goodText: null,
                improveText: null,
                tomorrowText: null,
            });

            assert.equal(await countEligibleDailyLogs(user.id, throughDate), 1);
            assert.equal(await prisma.dailyLog.count({ where: { userId: user.id } }), 2);
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

    await context.test('registration invitations are single-use and create consent atomically', async () => {
        const admin = await prisma.user.create({
            data: {
                loginId: `invite_admin_${randomUUID()}`,
                displayName: 'Invite integration admin',
                passwordHash: 'not-used-by-this-test',
                role: 'ADMIN',
            },
            select: { id: true },
        });
        const token = generateRegistrationInviteToken();
        const now = new Date('2026-08-03T00:00:00.000Z');
        const loginIds = [
            `invited_a_${randomUUID()}`,
            `invited_b_${randomUUID()}`,
        ] as const;

        try {
            const invite = await prisma.registrationInvite.create({
                data: {
                    tokenHash: hashRegistrationInviteToken(token),
                    athleteName: '招待された選手',
                    createdById: admin.id,
                    expiresAt: new Date('2026-08-10T00:00:00.000Z'),
                },
                select: { id: true },
            });

            const attempts = await Promise.allSettled(loginIds.map((loginId, index) => (
                registerInvitedUser({
                    inviteToken: token,
                    loginId,
                    passwordHash: `not-used-${index}`,
                    guardianName: `保護者 ${index + 1}`,
                    guardianRelationship: index === 0 ? '父' : '母',
                }, now)
            )));

            assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
            assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1);
            const rejected = attempts.find((result) => result.status === 'rejected');
            assert.ok(rejected && rejected.status === 'rejected');
            assert.ok(rejected.reason instanceof RegistrationInviteUnavailableError);

            const storedInvite = await prisma.registrationInvite.findUniqueOrThrow({
                where: { id: invite.id },
                select: { tokenHash: true, usedAt: true, usedByUserId: true },
            });
            assert.equal(storedInvite.tokenHash, hashRegistrationInviteToken(token));
            assert.equal(storedInvite.usedAt?.getTime(), now.getTime());
            assert.ok(storedInvite.usedByUserId);

            const registeredUsers = await prisma.user.findMany({
                where: { loginId: { in: [...loginIds] } },
                include: { guardianConsent: true },
            });
            assert.equal(registeredUsers.length, 1);
            const registeredUser = registeredUsers[0];
            assert.ok(registeredUser);
            assert.equal(registeredUser.id, storedInvite.usedByUserId);
            assert.equal(registeredUser.displayName, '招待された選手');
            assert.equal(registeredUser.membershipStatus, 'ACTIVE');
            assert.ok(registeredUser.guardianConsent);
            assert.equal(
                registeredUser.guardianConsent.noticeVersion,
                GUARDIAN_CONSENT_NOTICE_VERSION,
            );
            assert.equal(registeredUser.guardianConsent.acceptedAt.getTime(), now.getTime());
            assert.equal(
                await prisma.adminAuditEvent.count({
                    where: {
                        actorId: admin.id,
                        targetUserId: registeredUser.id,
                        action: 'INVITED_USER_REGISTERED',
                    },
                }),
                1,
            );

            await assert.rejects(
                () => registerInvitedUser({
                    inviteToken: token,
                    loginId: `invite_reuse_${randomUUID()}`,
                    passwordHash: 'not-used-reuse',
                    guardianName: '再利用 保護者',
                    guardianRelationship: '父',
                }, now),
                RegistrationInviteUnavailableError,
            );
        } finally {
            await prisma.registrationInvite.deleteMany({ where: { createdById: admin.id } });
            await prisma.adminAuditEvent.deleteMany({ where: { actorId: admin.id } });
            await prisma.user.deleteMany({ where: { loginId: { in: [...loginIds] } } });
            await prisma.user.delete({ where: { id: admin.id } });
        }
    });

    await context.test('withdrawn members retain records and sessions but every content write is blocked', async () => {
        const admin = await prisma.user.create({
            data: {
                loginId: `membership_admin_${randomUUID()}`,
                displayName: 'Membership integration admin',
                passwordHash: 'not-used-by-this-test',
                role: 'ADMIN',
            },
            select: { id: true },
        });
        const member = await prisma.user.create({
            data: {
                loginId: `withdrawn_member_${randomUUID()}`,
                displayName: 'Withdrawn integration member',
                passwordHash: 'not-used-by-this-test',
            },
            select: { id: true },
        });
        const logDate = new Date('2026-04-01T00:00:00.000Z');

        try {
            await createSession(member.id);
            await saveDailyLog({
                userId: member.id,
                logDate,
                baseRevision: null,
                score: 6,
                activityType: 'PRACTICE',
                goodText: '退会前の日誌',
                improveText: null,
                tomorrowText: null,
            });
            await saveStoryVersion(member.id, {
                baseVersion: null,
                answers: [{ questionNo: 1, answerText: '退会前の物語' }],
                note: null,
            });
            const activeGoal = await createCompetitionGoal(member.id, {
                type: 'NEXT_MEET',
                title: '退会前の大会目標',
                details: '大会名',
                targetDate: new Date('2026-09-01T00:00:00.000Z'),
            });
            const goalToArchive = await createCompetitionGoal(member.id, {
                type: 'MILESTONE',
                title: '退会前の過去目標',
                details: null,
                targetDate: new Date('2026-12-31T00:00:00.000Z'),
            });
            const archivedGoal = await archiveCompetitionGoal(
                member.id,
                goalToArchive.id,
                goalToArchive.revision,
            );

            const statusChange = await setMembershipStatus(admin.id, member.id, 'WITHDRAWN');
            assert.equal(statusChange.changed, true);
            assert.ok(statusChange.withdrawnAt);

            const withdrawn = await prisma.user.findUniqueOrThrow({
                where: { id: member.id },
                select: { membershipStatus: true, withdrawnAt: true },
            });
            assert.equal(withdrawn.membershipStatus, 'WITHDRAWN');
            assert.ok(withdrawn.withdrawnAt);
            assert.equal(await prisma.session.count({ where: { userId: member.id } }), 1);

            // Read paths deliberately remain available and all pre-withdrawal data stays intact.
            assert.equal(await countEligibleDailyLogs(member.id, logDate), 1);
            assert.equal(await prisma.storyVersion.count({ where: { userId: member.id } }), 1);
            assert.equal((await listCompetitionGoals(member.id, true)).length, 2);

            await assert.rejects(
                () => saveDailyLog({
                    userId: member.id,
                    logDate,
                    baseRevision: 1,
                    score: 8,
                    activityType: 'REST',
                    goodText: '更新できない日誌',
                    improveText: null,
                    tomorrowText: null,
                }),
                MembershipWriteBlockedError,
            );
            await assert.rejects(
                () => saveDailyLog({
                    userId: member.id,
                    logDate: new Date('2026-04-02T00:00:00.000Z'),
                    baseRevision: null,
                    score: 8,
                    activityType: 'PRACTICE',
                    goodText: '新規作成できない日誌',
                    improveText: null,
                    tomorrowText: null,
                }),
                MembershipWriteBlockedError,
            );
            await assert.rejects(
                () => saveStoryVersion(member.id, {
                    baseVersion: 1,
                    answers: [{ questionNo: 1, answerText: '更新できない物語' }],
                    note: null,
                }),
                MembershipWriteBlockedError,
            );
            await assert.rejects(
                () => createCompetitionGoal(member.id, {
                    type: 'NEXT_MEET',
                    title: '追加できない目標',
                    details: null,
                    targetDate: null,
                }),
                MembershipWriteBlockedError,
            );
            await assert.rejects(
                () => updateCompetitionGoal(member.id, activeGoal.id, {
                    baseRevision: activeGoal.revision,
                    title: '更新できない目標',
                }),
                MembershipWriteBlockedError,
            );
            await assert.rejects(
                () => archiveCompetitionGoal(member.id, activeGoal.id, activeGoal.revision),
                MembershipWriteBlockedError,
            );
            await assert.rejects(
                () => deleteArchivedCompetitionGoal(
                    member.id,
                    archivedGoal.id,
                    archivedGoal.revision,
                ),
                MembershipWriteBlockedError,
            );

            assert.equal(await prisma.dailyLog.count({ where: { userId: member.id } }), 1);
            assert.equal(await prisma.storyVersion.count({ where: { userId: member.id } }), 1);
            assert.equal(await prisma.competitionGoal.count({ where: { userId: member.id } }), 2);

            const reactivated = await setMembershipStatus(admin.id, member.id, 'ACTIVE');
            assert.equal(reactivated.changed, true);
            assert.equal(reactivated.withdrawnAt, null);
            assert.deepEqual(await saveDailyLog({
                userId: member.id,
                logDate,
                baseRevision: 1,
                score: 7,
                activityType: 'PRACTICE',
                goodText: '利用再開後の日誌',
                improveText: null,
                tomorrowText: null,
            }), { revision: 2 });
        } finally {
            await prisma.adminAuditEvent.deleteMany({ where: { actorId: admin.id } });
            await prisma.user.delete({ where: { id: member.id } });
            await prisma.user.delete({ where: { id: admin.id } });
        }
    });
});

test.after(async () => {
    await prisma.$disconnect();
});
