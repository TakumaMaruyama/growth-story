import type { NextRequest } from '@/lib/express-compat';
import { prisma } from '@/lib/prisma';
import { createSession, setSessionCookie } from '@/lib/auth';
import {
    hashPassword,
    passwordHashNeedsUpgrade,
    verifyPasswordWithTimingPadding,
} from '@/lib/password';
import { readJsonObject, jsonResponse } from '@/lib/request';
import { parseLoginInput } from '@/lib/validation';
import {
    consumeRateLimits,
    getClientIdentifier,
    type RateLimitRule,
} from '@/lib/rate-limit';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
    try {
        const json = await readJsonObject(request, 16 * 1024);
        if (!json.ok) return json.response;
        const input = parseLoginInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const { loginId, rawLoginId, password, adminOnly } = input.value;
        const sourceIdentifier = getClientIdentifier(request);
        const accountRule: RateLimitRule = {
            namespace: 'login-account',
            identifier: loginId,
            maxAttempts: 8,
            windowMs: LOGIN_WINDOW_MS,
        };
        const sourceRule: RateLimitRule = {
            namespace: 'login-source',
            identifier: sourceIdentifier,
            maxAttempts: 20,
            windowMs: LOGIN_WINDOW_MS,
        };
        const globalRule: RateLimitRule = {
            namespace: 'login-global',
            identifier: 'all',
            maxAttempts: 5_000,
            windowMs: LOGIN_WINDOW_MS,
        };
        const rateLimit = await consumeRateLimits([accountRule, sourceRule, globalRule]);
        if (!rateLimit.allowed) {
            const response = jsonResponse(
                { error: 'ログイン試行が多すぎます。しばらく待ってから再度お試しください' },
                429,
            );
            response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
            return response;
        }

        // Find user
        const lookupIds = rawLoginId === loginId ? [loginId] : [rawLoginId, loginId];
        const matchingUsers = await prisma.user.findMany({
            where: { loginId: { in: lookupIds } },
            take: 2,
            select: {
                id: true,
                loginId: true,
                role: true,
                isActive: true,
                passwordHash: true,
            },
        });
        // Exact input wins when a legacy whitespace-bearing ID and its trimmed
        // form both exist. Otherwise normal logins tolerate accidental spacing.
        const user = matchingUsers.find((candidate) => candidate.loginId === rawLoginId)
            ?? matchingUsers.find((candidate) => candidate.loginId === loginId);

        // Every path performs one cost-10 and one cost-12 bcrypt comparison.
        // This keeps legacy hashes usable without making account existence easy
        // to infer from their cheaper historical work factor.
        const passwordCheck = await verifyPasswordWithTimingPadding(password, user?.passwordHash);
        const isValid = passwordCheck.isValid;
        if (!user || !user.isActive || !isValid || (adminOnly && user.role !== 'ADMIN')) {
            return jsonResponse(
                { error: 'ログインIDまたはパスワードが正しくありません' },
                401,
            );
        }

        if (passwordHashNeedsUpgrade(user.passwordHash)) {
            const upgradedHash = await hashPassword(password);
            await prisma.user.updateMany({
                where: { id: user.id, passwordHash: user.passwordHash },
                data: { passwordHash: upgradedHash },
            });
        }

        // Create session
        const token = await createSession(user.id);
        await setSessionCookie(token);

        return jsonResponse({
            success: true,
            role: user.role,
        });
    } catch (error) {
        request.log.error('Login error:', error);
        return jsonResponse({ error: 'サーバーエラーが発生しました' }, 500);
    }
}
