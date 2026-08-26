import { NextRequest } from 'next/server';
import {
    InvalidPasswordResetTokenError,
    resetPasswordWithToken,
} from '@/lib/password-reset-service';
import { parsePasswordResetInput } from '@/lib/password-reset-validation';
import {
    consumeRateLimits,
    getClientIdentifier,
    type RateLimitRule,
} from '@/lib/rate-limit';
import { jsonResponse, readJsonObject } from '@/lib/request';

const RESET_WINDOW_MS = 15 * 60 * 1000;
const INVALID_RESET_LINK_MESSAGE =
    'この再設定URLは無効か、有効期限が切れています。管理者へ新しいURLを依頼してください';

export async function POST(request: NextRequest) {
    try {
        const json = await readJsonObject(request, 16 * 1024);
        if (!json.ok) return json.response;

        const tokenIdentifier = typeof json.data.token === 'string'
            ? json.data.token.slice(0, 128)
            : 'invalid';
        const rules: RateLimitRule[] = [
            {
                namespace: 'password-reset-token',
                identifier: tokenIdentifier,
                maxAttempts: 8,
                windowMs: RESET_WINDOW_MS,
            },
            {
                namespace: 'password-reset-source',
                identifier: getClientIdentifier(request),
                maxAttempts: 20,
                windowMs: RESET_WINDOW_MS,
            },
            {
                namespace: 'password-reset-global',
                identifier: 'all',
                maxAttempts: 2_000,
                windowMs: RESET_WINDOW_MS,
            },
        ];
        const rateLimit = await consumeRateLimits(rules);
        if (!rateLimit.allowed) {
            const response = jsonResponse(
                { error: '再設定の試行が多すぎます。しばらく待ってから再度お試しください' },
                429,
            );
            response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
            return response;
        }

        const input = parsePasswordResetInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        await resetPasswordWithToken(input.value.token, input.value.password);
        return jsonResponse({ success: true });
    } catch (error) {
        if (error instanceof InvalidPasswordResetTokenError) {
            return jsonResponse({ error: INVALID_RESET_LINK_MESSAGE }, 400);
        }
        console.error('Password reset error:', error);
        return jsonResponse({ error: 'パスワードを再設定できませんでした' }, 500);
    }
}
