import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { jsonResponse, readJsonObject } from '@/lib/request';
import { parseAccountInput } from '@/lib/validation';

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

export async function POST(request: NextRequest) {
    const admin = await getCurrentUser();
    if (!admin) return jsonResponse({ error: '認証が必要です' }, 401);
    if (admin.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    try {
        const json = await readJsonObject(request, 32 * 1024);
        if (!json.ok) return json.response;
        const input = parseAccountInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const { loginId, displayName, password } = input.value;
        const passwordHash = await hashPassword(password);
        const created = await prisma.$transaction(async (tx) => {
            const target = await tx.user.create({
                data: { loginId, displayName, passwordHash, role: 'USER' },
                select: { id: true },
            });
            await tx.adminAuditEvent.create({
                data: {
                    actorId: admin.id,
                    targetUserId: target.id,
                    action: 'USER_CREATED',
                },
            });
            return target;
        });

        return jsonResponse({ success: true, userId: created.id }, 201);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return jsonResponse({ error: 'このログインIDは既に使用されています' }, 409);
        }
        console.error('User create error:', error);
        return jsonResponse({ error: 'ユーザーを作成できませんでした' }, 500);
    }
}
