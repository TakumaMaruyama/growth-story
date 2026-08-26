import { Prisma } from '@prisma/client';
import type { NextRequest } from '@/lib/express-compat';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { jsonResponse, readJsonObject } from '@/lib/request';
import { parseStoryInput } from '@/lib/validation';
import { MAX_STORY_VERSIONS } from '@/lib/limits';
import { consumeRateLimits } from '@/lib/rate-limit';
import { storyWriteRateLimitRules } from '@/lib/story-write-rate-limit';
import {
    saveStoryVersion,
    StoryLimitError,
    StoryVersionConflictError,
} from '@/lib/story-service';
import {
    canMemberWrite,
    MEMBERSHIP_WITHDRAWN_CODE,
    MEMBERSHIP_WITHDRAWN_MESSAGE,
    MembershipWriteBlockedError,
} from '@/lib/member-access';

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return jsonResponse({ error: '認証が必要です' }, 401);
    if (user.role !== 'USER') return jsonResponse({ error: 'この機能は選手専用です' }, 403);

    try {
        const story = await prisma.storyVersion.findFirst({
            where: { userId: user.id },
            orderBy: { version: 'desc' },
            select: {
                version: true,
                answers: {
                    orderBy: { questionNo: 'asc' },
                    select: { questionNo: true, answerText: true },
                },
            },
        });

        return jsonResponse({
            user: {
                id: user.id,
                displayName: user.displayName,
                membershipStatus: user.membershipStatus,
            },
            story,
        });
    } catch (error) {
        request.log.error('Story read error:', error);
        return jsonResponse({ error: '競泳物語を読み込めませんでした' }, 500);
    }
}

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return jsonResponse({ error: '認証が必要です' }, 401);
    if (user.role !== 'USER') return jsonResponse({ error: 'この機能は選手専用です' }, 403);
    if (!canMemberWrite(user)) {
        return jsonResponse({
            error: MEMBERSHIP_WITHDRAWN_MESSAGE,
            code: MEMBERSHIP_WITHDRAWN_CODE,
        }, 403);
    }

    try {
        const rateLimit = await consumeRateLimits(storyWriteRateLimitRules(user.id));
        if (!rateLimit.allowed) {
            const response = jsonResponse(
                { error: '保存回数が多すぎます。しばらく待ってから再度お試しください' },
                429,
            );
            response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
            return response;
        }

        const json = await readJsonObject(request);
        if (!json.ok) return json.response;
        const input = parseStoryInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const result = await saveStoryVersion(user.id, input.value);
        return jsonResponse({ success: true, ...result });
    } catch (error) {
        if (error instanceof MembershipWriteBlockedError) {
            return jsonResponse({
                error: MEMBERSHIP_WITHDRAWN_MESSAGE,
                code: MEMBERSHIP_WITHDRAWN_CODE,
            }, 403);
        }
        if (error instanceof StoryVersionConflictError) {
            return jsonResponse({
                error: '別のタブで競泳物語が更新されています。最新の内容を読み込んでから編集し直してください',
                code: 'STORY_VERSION_CONFLICT',
                currentVersion: error.currentVersion,
            }, 409);
        }
        if (error instanceof StoryLimitError) {
            return jsonResponse(
                { error: `物語の保存上限（${MAX_STORY_VERSIONS}件）に達しました` },
                409,
            );
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError
            && (error.code === 'P2002' || error.code === 'P2034')) {
            return jsonResponse({
                error: '同時に更新されました。最新の内容を読み込んでから編集し直してください',
                code: 'STORY_VERSION_CONFLICT',
            }, 409);
        }
        request.log.error('Story save error:', error);
        return jsonResponse({ error: '競泳物語を保存できませんでした' }, 500);
    }
}
