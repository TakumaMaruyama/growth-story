import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createSession } from '../lib/auth';
import { hashPassword, verifyPassword } from '../lib/password';
import {
    InvalidPasswordResetTokenError,
    issuePasswordResetToken,
    PasswordResetAdminTargetError,
    PasswordResetInactiveTargetError,
    resetPasswordWithToken,
} from '../lib/password-reset-service';
import {
    generatePasswordResetToken,
    hashPasswordResetToken,
} from '../lib/password-reset-token';
import { PASSWORD_RESET_TTL_MS } from '../lib/password-reset-shared';
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

test('password reset links expire, rotate, consume once, and revoke sessions', async () => {
    const admin = await prisma.user.create({
        data: {
            loginId: `reset_admin_${randomUUID()}`,
            displayName: 'Reset admin',
            role: 'ADMIN',
            passwordHash: 'not-used-by-this-test',
        },
        select: { id: true },
    });
    const oldPassword = 'old-pass-2026';
    const user = await prisma.user.create({
        data: {
            loginId: `reset_user_${randomUUID()}`,
            displayName: 'Reset user',
            passwordHash: await hashPassword(oldPassword),
        },
        select: { id: true },
    });

    try {
        await Promise.all([createSession(user.id), createSession(user.id)]);
        assert.equal(await prisma.session.count({ where: { userId: user.id } }), 2);

        const first = await issuePasswordResetToken(admin.id, user.id);
        const firstStored = await prisma.passwordResetToken.findUniqueOrThrow({
            where: { tokenHash: hashPasswordResetToken(first.token) },
        });
        assert.equal(first.expiresAt.getTime() - firstStored.createdAt.getTime(), PASSWORD_RESET_TTL_MS);
        assert.notEqual(firstStored.tokenHash, first.token);
        assert.equal(firstStored.usedAt, null);
        assert.equal(firstStored.revokedAt, null);

        const second = await issuePasswordResetToken(admin.id, user.id);
        const rotatedFirst = await prisma.passwordResetToken.findUniqueOrThrow({
            where: { id: firstStored.id },
            select: { revokedAt: true },
        });
        assert.ok(rotatedFirst.revokedAt);

        const newPassword = 'new-pass-2026';
        await resetPasswordWithToken(second.token, newPassword);
        const updatedUser = await prisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { passwordHash: true },
        });
        assert.equal(await verifyPassword(newPassword, updatedUser.passwordHash), true);
        assert.equal(await verifyPassword(oldPassword, updatedUser.passwordHash), false);
        assert.equal(await prisma.session.count({ where: { userId: user.id } }), 0);

        const usedSecond = await prisma.passwordResetToken.findUniqueOrThrow({
            where: { tokenHash: hashPasswordResetToken(second.token) },
            select: { usedAt: true, revokedAt: true },
        });
        assert.ok(usedSecond.usedAt);
        assert.equal(usedSecond.revokedAt, null);
        await assert.rejects(
            resetPasswordWithToken(second.token, 'another-pass-2026'),
            InvalidPasswordResetTokenError,
        );

        const concurrent = await issuePasswordResetToken(admin.id, user.id);
        const concurrentResults = await Promise.allSettled([
            resetPasswordWithToken(concurrent.token, 'race-pass-2026'),
            resetPasswordWithToken(concurrent.token, 'race-pass-2026'),
        ]);
        assert.equal(concurrentResults.filter((result) => result.status === 'fulfilled').length, 1);
        assert.equal(concurrentResults.filter((result) => result.status === 'rejected').length, 1);

        const expiredToken = generatePasswordResetToken();
        const expiredCreatedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                createdById: admin.id,
                tokenHash: hashPasswordResetToken(expiredToken),
                createdAt: expiredCreatedAt,
                expiresAt: new Date(expiredCreatedAt.getTime() + PASSWORD_RESET_TTL_MS),
            },
        });
        await assert.rejects(
            resetPasswordWithToken(expiredToken, 'expired-pass-2026'),
            InvalidPasswordResetTokenError,
        );

        await assert.rejects(
            issuePasswordResetToken(admin.id, admin.id),
            PasswordResetAdminTargetError,
        );
        await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
        await assert.rejects(
            issuePasswordResetToken(admin.id, user.id),
            PasswordResetInactiveTargetError,
        );

        assert.equal(
            await prisma.adminAuditEvent.count({
                where: {
                    actorId: admin.id,
                    targetUserId: user.id,
                    action: 'PASSWORD_RESET_LINK_ISSUED',
                },
            }),
            3,
        );
    } finally {
        await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await prisma.adminAuditEvent.deleteMany({ where: { actorId: admin.id } });
        await prisma.user.deleteMany({ where: { id: { in: [user.id, admin.id] } } });
    }
});

test.after(async () => {
    await prisma.$disconnect();
});
