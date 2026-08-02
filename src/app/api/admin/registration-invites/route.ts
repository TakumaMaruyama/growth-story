import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { REGISTRATION_INVITE_VALID_DAYS } from '@/lib/limits';
import { prisma } from '@/lib/prisma';
import {
    generateRegistrationInviteToken,
    hashRegistrationInviteToken,
} from '@/lib/registration-invite';
import { jsonResponse, readJsonObject } from '@/lib/request';
import { parseInviteCreateInput } from '@/lib/validation';

const INVITE_PAGE_SIZE = 100;

export async function GET() {
    const admin = await getCurrentUser();
    if (!admin) return jsonResponse({ error: '認証が必要です' }, 401);
    if (admin.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    try {
        const invites = await prisma.registrationInvite.findMany({
            orderBy: { createdAt: 'desc' },
            take: INVITE_PAGE_SIZE,
            select: {
                id: true,
                athleteName: true,
                expiresAt: true,
                usedAt: true,
                revokedAt: true,
                createdAt: true,
                usedBy: { select: { displayName: true } },
            },
        });
        return jsonResponse({ invites });
    } catch (error) {
        console.error('Registration invite list error:', error);
        return jsonResponse({ error: '登録URLの一覧を読み込めませんでした' }, 500);
    }
}

export async function POST(request: NextRequest) {
    const admin = await getCurrentUser();
    if (!admin) return jsonResponse({ error: '認証が必要です' }, 401);
    if (admin.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    try {
        const json = await readJsonObject(request, 8 * 1024);
        if (!json.ok) return json.response;
        const input = parseInviteCreateInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const token = generateRegistrationInviteToken();
        const expiresAt = new Date(
            Date.now() + REGISTRATION_INVITE_VALID_DAYS * 24 * 60 * 60 * 1000,
        );
        const invite = await prisma.$transaction(async (tx) => {
            const created = await tx.registrationInvite.create({
                data: {
                    tokenHash: hashRegistrationInviteToken(token),
                    athleteName: input.value.athleteName,
                    createdById: admin.id,
                    expiresAt,
                },
                select: { id: true, athleteName: true, expiresAt: true, createdAt: true },
            });
            await tx.adminAuditEvent.create({
                data: { actorId: admin.id, action: 'REGISTRATION_INVITE_CREATED' },
            });
            return created;
        });

        // The raw token is returned only once and is never stored in the database.
        return jsonResponse({ success: true, token, invite }, 201);
    } catch (error) {
        console.error('Registration invite create error:', error);
        return jsonResponse({ error: '登録URLを発行できませんでした' }, 500);
    }
}
