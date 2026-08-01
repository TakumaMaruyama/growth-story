import { getCurrentUser } from '@/lib/auth';
import { serializeCompetitionGoal } from '@/lib/competition-goal-contract';
import { listCompetitionGoals } from '@/lib/competition-goal-service';
import { prisma } from '@/lib/prisma';
import { jsonResponse } from '@/lib/request';

interface Props {
    params: Promise<{ userId: string }>;
}

export async function GET(_request: Request, { params }: Props) {
    const admin = await getCurrentUser();
    if (!admin) return jsonResponse({ error: '認証が必要です' }, 401);
    if (admin.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    const { userId } = await params;
    try {
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, displayName: true },
        });
        if (!targetUser) return jsonResponse({ error: 'ユーザーが見つかりません' }, 404);

        const goals = await listCompetitionGoals(userId, true);
        await prisma.adminAuditEvent.create({
            data: {
                actorId: admin.id,
                targetUserId: userId,
                action: 'COMPETITION_GOALS_VIEWED',
            },
        });

        return jsonResponse({
            adminUser: { displayName: admin.displayName },
            targetUser,
            goals: goals.map(serializeCompetitionGoal),
        });
    } catch (error) {
        console.error('Admin competition goal read error:', error);
        return jsonResponse({ error: '大会目標を読み込めませんでした' }, 500);
    }
}
