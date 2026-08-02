import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { jsonResponse } from '@/lib/request';

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return jsonResponse({ error: '認証が必要です' }, 401);
    if (user.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    const cursor = request.nextUrl.searchParams.get('cursor') || undefined;

    try {
        const users = await prisma.user.findMany({
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: PAGE_SIZE + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true,
                loginId: true,
                displayName: true,
                role: true,
                isActive: true,
                membershipStatus: true,
                withdrawnAt: true,
                createdAt: true,
            },
        });
        const hasMore = users.length > PAGE_SIZE;
        const page = hasMore ? users.slice(0, PAGE_SIZE) : users;

        return jsonResponse({
            adminUser: { displayName: user.displayName },
            users: page,
            nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
        });
    } catch (error) {
        console.error('User list error:', error);
        return jsonResponse({ error: 'ユーザー一覧を読み込めませんでした' }, 500);
    }
}
