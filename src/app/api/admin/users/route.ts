import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { jsonResponse } from '@/lib/request';
import { getUserFullName, hasStructuredRealName } from '@/lib/user-name';
import { getMemberLatestUpdate } from '@/lib/member-latest-update';
import { getDailyLogBadgeDisplay } from '@/lib/daily-log-badges';
import {
    differenceInDateOnlyDays,
    formatJSTDate,
    parseDateOnly,
    todayJST,
} from '@/lib/date';

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return jsonResponse({ error: '認証が必要です' }, 401);
    if (user.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    const cursor = request.nextUrl.searchParams.get('cursor') || undefined;
    const todayDate = parseDateOnly(todayJST())!;

    try {
        const users = await prisma.user.findMany({
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: PAGE_SIZE + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true,
                loginId: true,
                displayName: true,
                familyName: true,
                givenName: true,
                role: true,
                isActive: true,
                membershipStatus: true,
                withdrawnAt: true,
                createdAt: true,
                dailyLogs: {
                    where: { logDate: { lte: todayDate } },
                    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                    take: 1,
                    select: { logDate: true, updatedAt: true },
                },
                competitionGoals: {
                    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                    take: 1,
                    select: { id: true, type: true, updatedAt: true },
                },
                storyVersions: {
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                    take: 1,
                    select: { id: true, version: true, createdAt: true },
                },
                _count: {
                    select: {
                        dailyLogs: { where: { logDate: { lte: todayDate } } },
                    },
                },
            },
        });
        const hasMore = users.length > PAGE_SIZE;
        const page = hasMore ? users.slice(0, PAGE_SIZE) : users;
        const latestDailyLogs = page.length === 0
            ? []
            : await prisma.dailyLog.findMany({
                where: {
                    userId: { in: page.map((target) => target.id) },
                    logDate: { lte: todayDate },
                },
                orderBy: [{ logDate: 'desc' }, { id: 'desc' }],
                select: { userId: true, logDate: true },
            });
        const latestDailyLogDates = new Map<string, Date>();
        for (const dailyLog of latestDailyLogs) {
            if (!latestDailyLogDates.has(dailyLog.userId)) {
                latestDailyLogDates.set(dailyLog.userId, dailyLog.logDate);
            }
        }
        const serializedUsers = page.map((target) => {
            const latestDailyLogDate = latestDailyLogDates.get(target.id) ?? null;
            return {
                id: target.id,
                loginId: target.loginId,
                displayName: target.displayName,
                fullName: getUserFullName(target),
                hasRealName: hasStructuredRealName(target),
                role: target.role,
                isActive: target.isActive,
                membershipStatus: target.membershipStatus,
                withdrawnAt: target.withdrawnAt,
                createdAt: target.createdAt,
                dailyLogCount: target._count.dailyLogs,
                dailyLogBadge: getDailyLogBadgeDisplay(target._count.dailyLogs),
                latestDailyLogDate: latestDailyLogDate ? formatJSTDate(latestDailyLogDate) : null,
                dailyLogDaysSinceLastEntry: latestDailyLogDate
                    ? differenceInDateOnlyDays(todayDate, latestDailyLogDate)
                    : null,
                latestUpdate: getMemberLatestUpdate(target.id, {
                    dailyLog: target.dailyLogs[0] ?? null,
                    competitionGoal: target.competitionGoals[0] ?? null,
                    storyVersion: target.storyVersions[0] ?? null,
                }),
            };
        });

        return jsonResponse({
            adminUser: { displayName: user.displayName },
            users: serializedUsers,
            nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
        });
    } catch (error) {
        console.error('User list error:', error);
        return jsonResponse({ error: 'ユーザー一覧を読み込めませんでした' }, 500);
    }
}
