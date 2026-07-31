import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, hashPassword, setSessionCookie } from '@/lib/auth';
import { readJsonObject, jsonResponse } from '@/lib/request';
import { parseAccountInput } from '@/lib/validation';
import {
    consumeRateLimits,
    getClientIdentifier,
    type RateLimitRule,
} from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        const json = await readJsonObject(request, 32 * 1024);
        if (!json.ok) return json.response;
        const input = parseAccountInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const { loginId, displayName, password } = input.value;
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
        const existing = await prisma.user.findUnique({
            where: { loginId },
            select: { id: true },
        });

        if (existing) {
            return jsonResponse({ error: 'このログインIDは既に使用されています' }, 409);
        }

        const passwordHash = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                loginId,
                displayName,
                passwordHash,
                role: 'USER',
                isActive: true,
            },
        });

        const token = await createSession(user.id);
        await setSessionCookie(token);

        return jsonResponse({ success: true, role: user.role }, 201);
    } catch (error) {
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
