import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { todayJST } from '@/lib/date';

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date') || todayJST();

    const log = await prisma.dailyLog.findUnique({
        where: {
            userId_logDate: {
                userId: user.id,
                logDate: new Date(dateStr),
            },
        },
    });

    return NextResponse.json({
        user: { displayName: user.displayName },
        today: todayJST(),
        log,
    });
}

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { date, score, practiced, goodText, improveText, tomorrowText } = await request.json();

        if (!date || !score) {
            return NextResponse.json({ error: '日付と点数は必須です' }, { status: 400 });
        }

        if (score < 1 || score > 10) {
            return NextResponse.json({ error: '点数は1〜10の範囲で入力してください' }, { status: 400 });
        }

        const logDate = new Date(date);

        // Upsert daily log
        await prisma.dailyLog.upsert({
            where: {
                userId_logDate: {
                    userId: user.id,
                    logDate,
                },
            },
            update: {
                score,
                practiced: practiced ?? false,
                goodText: goodText || null,
                improveText: improveText || null,
                tomorrowText: tomorrowText || null,
            },
            create: {
                userId: user.id,
                logDate,
                score,
                practiced: practiced ?? false,
                goodText: goodText || null,
                improveText: improveText || null,
                tomorrowText: tomorrowText || null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Daily log error:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
}
