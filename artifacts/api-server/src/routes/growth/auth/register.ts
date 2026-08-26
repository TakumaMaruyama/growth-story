import { Prisma } from '@prisma/client';
import type { NextRequest } from '@/lib/express-compat';
import { createSession, hashPassword, setSessionCookie } from '@/lib/auth';
import { readJsonObject, jsonResponse } from '@/lib/request';
import { parseSharedRegistrationInput } from '@/lib/validation';
import {
    consumeRateLimits,
    getClientIdentifier,
    type RateLimitRule,
} from '@/lib/rate-limit';
import { isSharedRegistrationAccessAllowed } from '@/lib/shared-registration';
import {
    AthleteAlreadyRegisteredError,
    registerUserWithGuardianConsent,
} from '@/lib/registration-service';

const UNAVAILABLE_REGISTRATION_MESSAGE = 'この登録URLは利用できません。管理者から届いた最新のURLを開いてください';

export async function POST(request: NextRequest) {
    try {
        const json = await readJsonObject(request, 32 * 1024);
        if (!json.ok) return json.response;
        const input = parseSharedRegistrationInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const {
            accessToken,
            athleteFamilyName,
            athleteGivenName,
            loginId,
            password,
            guardianName,
            guardianRelationship,
        } = input.value;
        if (!isSharedRegistrationAccessAllowed(accessToken)) {
            return jsonResponse({ error: UNAVAILABLE_REGISTRATION_MESSAGE }, 410);
        }
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
        const user = await registerUserWithGuardianConsent({
            athleteFamilyName,
            athleteGivenName,
            loginId,
            passwordHash,
            guardianName,
            guardianRelationship,
        });

        const token = await createSession(user.id);
        await setSessionCookie(token);

        return jsonResponse({ success: true, role: user.role }, 201);
    } catch (error) {
        if (error instanceof AthleteAlreadyRegisteredError) {
            return jsonResponse({
                error: 'この内容では登録できません。入力を確認するか、管理者へ連絡してください',
            }, 409);
        }
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return jsonResponse({ error: 'このログインIDは既に使用されています' }, 409);
        }

        request.log.error('Register error:', error);
        return jsonResponse({ error: 'サーバーエラーが発生しました' }, 500);
    }
}
