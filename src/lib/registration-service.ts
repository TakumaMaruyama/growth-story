import { Prisma } from '@prisma/client';
import { GUARDIAN_CONSENT_NOTICE_VERSION } from './guardian-consent';
import { prisma } from './prisma';
import {
    hashRegistrationInviteToken,
    isRegistrationInviteUsable,
} from './registration-invite';

export class RegistrationInviteUnavailableError extends Error {
    constructor() {
        super('Registration invite is unavailable');
    }
}

export interface InvitedRegistrationInput {
    inviteToken: string;
    loginId: string;
    passwordHash: string;
    guardianName: string;
    guardianRelationship: string;
}

export async function registerInvitedUser(
    input: InvitedRegistrationInput,
    now = new Date(),
): Promise<{ id: string; role: 'USER'; displayName: string }> {
    const tokenHash = hashRegistrationInviteToken(input.inviteToken);

    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
                hashtextextended(${`registration-invite:${tokenHash}`}, 0)
            )::text AS lock_result
        `;

        const invite = await tx.registrationInvite.findUnique({
            where: { tokenHash },
            select: {
                id: true,
                athleteName: true,
                createdById: true,
                expiresAt: true,
                usedAt: true,
                revokedAt: true,
            },
        });
        if (!invite || !isRegistrationInviteUsable(invite, now)) {
            throw new RegistrationInviteUnavailableError();
        }

        const user = await tx.user.create({
            data: {
                loginId: input.loginId,
                displayName: invite.athleteName,
                passwordHash: input.passwordHash,
                role: 'USER',
                isActive: true,
                membershipStatus: 'ACTIVE',
                guardianConsent: {
                    create: {
                        guardianName: input.guardianName,
                        guardianRelationship: input.guardianRelationship,
                        noticeVersion: GUARDIAN_CONSENT_NOTICE_VERSION,
                        acceptedAt: now,
                    },
                },
            },
            select: { id: true, role: true, displayName: true },
        });

        const consumed = await tx.registrationInvite.updateMany({
            where: {
                id: invite.id,
                usedAt: null,
                revokedAt: null,
                expiresAt: { gt: now },
            },
            data: { usedAt: now, usedByUserId: user.id },
        });
        if (consumed.count !== 1) throw new RegistrationInviteUnavailableError();

        await tx.adminAuditEvent.create({
            data: {
                actorId: invite.createdById,
                targetUserId: user.id,
                action: 'INVITED_USER_REGISTERED',
            },
        });

        return { id: user.id, role: 'USER' as const, displayName: user.displayName };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
