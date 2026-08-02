import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, hashPassword, setSessionCookie } from '@/lib/auth';
import { readJsonObject, jsonResponse } from '@/lib/request';
import { parseInviteRegistrationInput } from '@/lib/validation';
import {
    consumeRateLimits,
    getClientIdentifier,
    type RateLimitRule,
} from '@/lib/rate-limit';
import {
    hashRegistrationInviteToken,
    isRegistrationInviteToken,
    isRegistrationInviteUsable,
} from '@/lib/registration-invite';
import {
    registerInvitedUser,
    RegistrationInviteUnavailableError,
} from '@/lib/registration-service';

const UNAVAILABLE_INVITE_MESSAGE = 'この登録URLは利用できません。管理者へ再発行を依頼してください';

export async function GET(request: NextRequest) {
    const inviteToken = request.nextUrl.searchParams.get('invite');
    if (!isRegistrationInviteToken(inviteToken)) {
        return jsonResponse({ error: UNAVAILABLE_INVITE_MESSAGE }, 404);
    }

    try {
        const invite = await prisma.registrationInvite.findUnique({
            where: { tokenHash: hashRegistrationInviteToken(inviteToken) },
            select: {
                athleteName: true,
                expiresAt: true,
                usedAt: true,
                revokedAt: true,
            },
        });
        if (!invite || !isRegistrationInviteUsable(invite)) {
            return jsonResponse({ error: UNAVAILABLE_INVITE_MESSAGE }, 410);
        }
        return jsonResponse({ athleteName: invite.athleteName, expiresAt: invite.expiresAt });
    } catch (error) {
        console.error('Registration invite read error:', error);
        return jsonResponse({ error: '登録URLを確認できませんでした' }, 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const json = await readJsonObject(request, 32 * 1024);
        if (!json.ok) return json.response;
        const input = parseInviteRegistrationInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const {
            inviteToken,
            loginId,
            password,
            guardianName,
            guardianRelationship,
        } = input.value;
        const registrationRule: RateLimitRule = {
            namespace: 'registration-source',
            identifier: getClientIdentifier(request),
            maxAttempts: 5,
            windowMs: 60 * 60 * 1000,
        };
        const globalRegistrationRule: RateLimitRule = {
            namespace: 'registration-global',
            identifier: 'all',
            maxAttempts: 100,
            windowMs: 60 * 60 * 1000,
        };
        const rateLimit = await consumeRateLimits([registrationRule, globalRegistrationRule]);
        if (!rateLimit.allowed) {
            const response = jsonResponse(
                { error: '登録回数が多すぎます。しばらく待ってから再度お試しください' },
                429,
            );
            response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
            return response;
        }
        const passwordHash = await hashPassword(password);
        const user = await registerInvitedUser({
            inviteToken,
            loginId,
            passwordHash,
            guardianName,
            guardianRelationship,
        });

        const token = await createSession(user.id);
        await setSessionCookie(token);

        return jsonResponse({ success: true, role: user.role }, 201);
    } catch (error) {
        if (error instanceof RegistrationInviteUnavailableError) {
            return jsonResponse({ error: UNAVAILABLE_INVITE_MESSAGE }, 410);
        }
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return jsonResponse({ error: 'このログインIDは既に使用されています' }, 409);
        }

        console.error('Register error:', error);
        return jsonResponse({ error: 'サーバーエラーが発生しました' }, 500);
    }
}
