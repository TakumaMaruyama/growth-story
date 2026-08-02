import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonResponse, validateRequestOrigin } from '@/lib/request';

interface Props {
    params: Promise<{ inviteId: string }>;
}

export async function DELETE(request: NextRequest, { params }: Props) {
    const originError = validateRequestOrigin(request);
    if (originError) return originError;

    const admin = await getCurrentUser();
    if (!admin) return jsonResponse({ error: '認証が必要です' }, 401);
    if (admin.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    try {
        const { inviteId } = await params;
        const result = await prisma.$transaction(async (tx) => {
            const revoked = await tx.registrationInvite.updateMany({
                where: { id: inviteId, usedAt: null, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            if (revoked.count === 1) {
                await tx.adminAuditEvent.create({
                    data: { actorId: admin.id, action: 'REGISTRATION_INVITE_REVOKED' },
                });
            }
            return revoked.count;
        });
        if (result !== 1) {
            return jsonResponse({ error: 'この登録URLはすでに使用済み、期限切れ、または停止済みです' }, 409);
        }
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Registration invite revoke error:', error);
        return jsonResponse({ error: '登録URLを停止できませんでした' }, 500);
    }
}
