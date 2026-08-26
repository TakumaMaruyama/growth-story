import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { jsonResponse, readJsonObject } from '@/lib/request';
import { parseBooleanInput } from '@/lib/validation';

interface Props {
    params: Promise<{ userId: string }>;
}

class UserStateConflictError extends Error {}

export async function POST(request: NextRequest, { params }: Props) {
    const admin = await getCurrentUser();
    if (!admin) return jsonResponse({ error: '認証が必要です' }, 401);
    if (admin.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    const { userId } = await params;

    try {
        const json = await readJsonObject(request, 8 * 1024);
        if (!json.ok) return json.response;
        if (Object.keys(json.data).some((key) => key !== 'isActive')) {
            return jsonResponse({ error: 'リクエストの形式が正しくありません' }, 400);
        }
        const activeState = parseBooleanInput(json.data.isActive);
        if (!activeState.ok) return jsonResponse({ error: activeState.error }, 400);

        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, isActive: true },
        });
        if (!targetUser) return jsonResponse({ error: 'ユーザーが見つかりません' }, 404);
        if (targetUser.role === 'ADMIN') {
            return jsonResponse({ error: '管理者の状態は変更できません' }, 400);
        }
        if (targetUser.isActive === activeState.value) {
            return jsonResponse({ success: true, unchanged: true });
        }

        await prisma.$transaction(async (tx) => {
            const updated = await tx.user.updateMany({
                where: { id: userId, role: 'USER', isActive: targetUser.isActive },
                data: { isActive: activeState.value },
            });
            if (updated.count !== 1) throw new UserStateConflictError();

            if (!activeState.value) {
                await tx.session.deleteMany({ where: { userId } });
            }
            await tx.adminAuditEvent.create({
                data: {
                    actorId: admin.id,
                    targetUserId: userId,
                    action: activeState.value ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
                },
            });
        });

        return jsonResponse({ success: true, unchanged: false });
    } catch (error) {
        if (error instanceof UserStateConflictError) {
            return jsonResponse(
                { error: '別の管理画面で状態が変更されました。一覧を再読み込みしてください' },
                409,
            );
        }
        console.error('Toggle user error:', error);
        return jsonResponse({ error: 'ユーザー状態を変更できませんでした' }, 500);
    }
}
