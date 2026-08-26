import { Prisma, type MembershipStatus } from '@prisma/client';
import { prisma } from './prisma';

export const MEMBERSHIP_WITHDRAWN_CODE = 'MEMBERSHIP_WITHDRAWN';
export const MEMBERSHIP_WITHDRAWN_MESSAGE = '退会中のため、新規入力や更新はできません。過去の記録は閲覧できます。';

export class MembershipWriteBlockedError extends Error {
    constructor() {
        super(MEMBERSHIP_WITHDRAWN_MESSAGE);
    }
}

export class MembershipUserNotFoundError extends Error {}
export class MembershipAdminTargetError extends Error {}

export function canMemberWrite(user: { membershipStatus: MembershipStatus }): boolean {
    return user.membershipStatus === 'ACTIVE';
}

export async function lockMemberWriteState(
    tx: Prisma.TransactionClient,
    userId: string,
): Promise<void> {
    await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
            hashtextextended(${`member-write:${userId}`}, 0)
        )::text AS lock_result
    `;
}

export async function assertMemberWritableInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
): Promise<void> {
    await lockMemberWriteState(tx, userId);
    const user = await tx.user.findUnique({
        where: { id: userId },
        select: { membershipStatus: true },
    });
    if (!user || !canMemberWrite(user)) throw new MembershipWriteBlockedError();
}

export async function setMembershipStatus(
    actorId: string,
    targetUserId: string,
    membershipStatus: MembershipStatus,
): Promise<{ changed: boolean; withdrawnAt: Date | null }> {
    return prisma.$transaction(async (tx) => {
        await lockMemberWriteState(tx, targetUserId);
        const target = await tx.user.findUnique({
            where: { id: targetUserId },
            select: { role: true, membershipStatus: true, withdrawnAt: true },
        });
        if (!target) throw new MembershipUserNotFoundError();
        if (target.role === 'ADMIN') throw new MembershipAdminTargetError();
        if (target.membershipStatus === membershipStatus) {
            return { changed: false, withdrawnAt: target.withdrawnAt };
        }

        const withdrawnAt = membershipStatus === 'WITHDRAWN' ? new Date() : null;
        await tx.user.update({
            where: { id: targetUserId },
            data: { membershipStatus, withdrawnAt },
        });
        await tx.adminAuditEvent.create({
            data: {
                actorId,
                targetUserId,
                action: membershipStatus === 'WITHDRAWN'
                    ? 'MEMBERSHIP_WITHDRAWN'
                    : 'MEMBERSHIP_REACTIVATED',
            },
        });
        return { changed: true, withdrawnAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
