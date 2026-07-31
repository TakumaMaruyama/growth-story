import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { parseDateOnly } from '@/lib/date';
import { jsonResponse } from '@/lib/request';

interface Props {
    params: Promise<{ userId: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
    const admin = await getCurrentUser();
    if (!admin) return jsonResponse({ error: '認証が必要です' }, 401);
    if (admin.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    const { userId } = await params;
    const fromValue = request.nextUrl.searchParams.get('from');
    const toValue = request.nextUrl.searchParams.get('to');
    const from = fromValue ? parseDateOnly(fromValue) : null;
    const to = toValue ? parseDateOnly(toValue) : null;

    if ((fromValue && !from) || (toValue && !to)) {
        return jsonResponse({ error: '日付の範囲を正しく指定してください' }, 400);
    }
    if (from && to && from > to) {
        return jsonResponse({ error: '開始日は終了日以前にしてください' }, 400);
    }

    try {
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, displayName: true },
        });
        if (!targetUser) return jsonResponse({ error: 'ユーザーが見つかりません' }, 404);

        const results = await prisma.dailyLog.findMany({
            where: {
                userId,
                ...(from || to ? {
                    logDate: {
                        ...(from ? { gte: from } : {}),
                        ...(to ? { lte: to } : {}),
                    },
                } : {}),
            },
            orderBy: { logDate: 'desc' },
            take: 201,
            select: {
                id: true,
                logDate: true,
                score: true,
                practiced: true,
            },
        });
        const truncated = results.length > 200;
        const logs = truncated ? results.slice(0, 200) : results;

        return jsonResponse({
            adminUser: { displayName: admin.displayName },
            targetUser,
            logs,
            truncated,
        });
    } catch (error) {
        console.error('Admin daily log read error:', error);
        return jsonResponse({ error: '日誌一覧を読み込めませんでした' }, 500);
    }
}
