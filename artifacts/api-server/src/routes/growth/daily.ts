import type { NextRequest } from '@/lib/express-compat';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { parseDailyLogDate, parseDateOnly, todayJST } from '@/lib/date';
import { jsonResponse, readJsonObject } from '@/lib/request';
import { parseDailyLogInput } from '@/lib/validation';
import { consumeRateLimits, type RateLimitRule } from '@/lib/rate-limit';
import {
    countDailyLogBadgeReachUsers,
    countEligibleDailyLogs,
    DailyLogConflictError,
    saveDailyLog,
} from '@/lib/daily-log-service';
import {
    canMemberWrite,
    MEMBERSHIP_WITHDRAWN_CODE,
    MEMBERSHIP_WITHDRAWN_MESSAGE,
    MembershipWriteBlockedError,
} from '@/lib/member-access';

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return jsonResponse({ error: '認証が必要です' }, 401);
    if (user.role !== 'USER') return jsonResponse({ error: '利用者アカウント専用の機能です' }, 403);

    const today = todayJST();
    const date = request.nextUrl.searchParams.get('date') || today;
    const logDate = parseDailyLogDate(date);
    if (!logDate) {
        return jsonResponse({
            error: '日付は1970年以降、今日までで指定してください',
            today,
        }, 400);
    }

    try {
        const todayDate = parseDateOnly(today)!;
        const [log, previousFocusLog, eligibleRecordCount, badgeReachCounts] = await Promise.all([
            prisma.dailyLog.findUnique({
                where: { userId_logDate: { userId: user.id, logDate } },
                select: {
                    score: true,
                    activityType: true,
                    practiced: true,
                    goodText: true,
                    improveText: true,
                    tomorrowText: true,
                    revision: true,
                    updatedAt: true,
                },
            }),
            prisma.dailyLog.findFirst({
                where: {
                    userId: user.id,
                    logDate: { lt: logDate },
                    AND: [
                        { tomorrowText: { not: null } },
                        { tomorrowText: { not: '' } },
                    ],
                },
                orderBy: { logDate: 'desc' },
                select: { tomorrowText: true },
            }),
            countEligibleDailyLogs(user.id, todayDate),
            countDailyLogBadgeReachUsers(todayDate),
        ]);

        return jsonResponse({
            user: {
                id: user.id,
                displayName: user.displayName,
                membershipStatus: user.membershipStatus,
            },
            date,
            today,
            log,
            previousFocus: previousFocusLog?.tomorrowText ?? null,
            eligibleRecordCount,
            badgeReachCounts,
        });
    } catch (error) {
        request.log.error('Daily log read error:', error);
        return jsonResponse({ error: '日誌を読み込めませんでした' }, 500);
    }
}

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return jsonResponse({ error: '認証が必要です' }, 401);
    if (user.role !== 'USER') return jsonResponse({ error: '利用者アカウント専用の機能です' }, 403);
    if (!canMemberWrite(user)) {
        return jsonResponse({
            error: MEMBERSHIP_WITHDRAWN_MESSAGE,
            code: MEMBERSHIP_WITHDRAWN_CODE,
        }, 403);
    }

    try {
        const writeRule: RateLimitRule = {
            namespace: 'daily-write-user',
            identifier: user.id,
            maxAttempts: 120,
            windowMs: 60 * 60 * 1000,
        };
        const rateLimit = await consumeRateLimits([writeRule]);
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
        const input = parseDailyLogInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const log = await saveDailyLog({ userId: user.id, ...input.value });
        const todayDate = parseDateOnly(todayJST())!;
        const [eligibleRecordCount, badgeReachCounts] = await Promise.all([
            countEligibleDailyLogs(user.id, todayDate),
            countDailyLogBadgeReachUsers(todayDate),
        ]);

        return jsonResponse({
            success: true,
            revision: log.revision,
            created: input.value.baseRevision === null,
            eligibleRecordCount,
            badgeReachCounts,
        });
    } catch (error) {
        if (error instanceof MembershipWriteBlockedError) {
            return jsonResponse({
                error: MEMBERSHIP_WITHDRAWN_MESSAGE,
                code: MEMBERSHIP_WITHDRAWN_CODE,
            }, 403);
        }
        if (error instanceof DailyLogConflictError) {
            return jsonResponse(
                { error: '別の画面で日誌が更新されました。再読み込みして内容を確認してください' },
                409,
            );
        }
        request.log.error('Daily log save error:', error);
        return jsonResponse({ error: '日誌を保存できませんでした' }, 500);
    }
}
