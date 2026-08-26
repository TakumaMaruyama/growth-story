import { Prisma } from '@prisma/client';
import { hashPassword } from './password';
import {
    getPasswordResetExpiry,
    isPasswordResetToken,
} from './password-reset-shared';
import {
    generatePasswordResetToken,
    hashPasswordResetToken,
} from './password-reset-token';
import { prisma } from './prisma';

export class PasswordResetTargetNotFoundError extends Error {}
export class PasswordResetAdminTargetError extends Error {}
export class PasswordResetInactiveTargetError extends Error {}
export class InvalidPasswordResetTokenError extends Error {}

export interface IssuedPasswordResetToken {
    token: string;
    expiresAt: Date;
}

export async function issuePasswordResetToken(
    adminId: string,
    userId: string,
): Promise<IssuedPasswordResetToken> {
    const token = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);
    const createdAt = new Date();
    const expiresAt = getPasswordResetExpiry(createdAt);

    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
                hashtextextended(${`password-reset-user:${userId}`}, 0)
            )::text AS lock_result
        `;

        const target = await tx.user.findUnique({
            where: { id: userId },
            select: { role: true, isActive: true },
        });
        if (!target) throw new PasswordResetTargetNotFoundError();
        if (target.role === 'ADMIN') throw new PasswordResetAdminTargetError();
        if (!target.isActive) throw new PasswordResetInactiveTargetError();

        await tx.passwordResetToken.updateMany({
            where: { userId, usedAt: null, revokedAt: null },
            data: { revokedAt: createdAt },
        });
        await tx.passwordResetToken.create({
            data: {
                userId,
                createdById: adminId,
                tokenHash,
                createdAt,
                expiresAt,
            },
        });
        await tx.adminAuditEvent.create({
            data: {
                actorId: adminId,
                targetUserId: userId,
                action: 'PASSWORD_RESET_LINK_ISSUED',
            },
        });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    return { token, expiresAt };
}

export async function resetPasswordWithToken(
    token: string,
    password: string,
): Promise<void> {
    if (!isPasswordResetToken(token)) throw new InvalidPasswordResetTokenError();

    // Run the expensive hash before looking up the token so invalid links do
    // not become a cheap oracle. Route-level rate limits bound this work.
    const passwordHash = await hashPassword(password);
    const tokenHash = hashPasswordResetToken(token);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
                hashtextextended(${`password-reset-token:${tokenHash}`}, 0)
            )::text AS lock_result
        `;

        const resetToken = await tx.passwordResetToken.findUnique({
            where: { tokenHash },
            select: {
                id: true,
                userId: true,
                expiresAt: true,
                usedAt: true,
                revokedAt: true,
                user: { select: { role: true, isActive: true } },
            },
        });
        if (
            !resetToken
            || resetToken.usedAt
            || resetToken.revokedAt
            || resetToken.expiresAt <= now
            || resetToken.user.role !== 'USER'
            || !resetToken.user.isActive
        ) {
            throw new InvalidPasswordResetTokenError();
        }

        const consumed = await tx.passwordResetToken.updateMany({
            where: {
                id: resetToken.id,
                usedAt: null,
                revokedAt: null,
                expiresAt: { gt: now },
            },
            data: { usedAt: now },
        });
        if (consumed.count !== 1) throw new InvalidPasswordResetTokenError();

        await tx.user.update({
            where: { id: resetToken.userId },
            data: { passwordHash },
        });
        await tx.session.deleteMany({ where: { userId: resetToken.userId } });
        await tx.passwordResetToken.updateMany({
            where: {
                userId: resetToken.userId,
                id: { not: resetToken.id },
                usedAt: null,
                revokedAt: null,
            },
            data: { revokedAt: now },
        });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
