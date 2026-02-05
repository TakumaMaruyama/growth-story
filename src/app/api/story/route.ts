import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get latest story version with answers
    const story = await prisma.storyVersion.findFirst({
        where: { userId: user.id },
        orderBy: { version: 'desc' },
        include: { answers: true },
    });

    return NextResponse.json({
        user: { displayName: user.displayName },
        story,
    });
}

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { answers, note } = await request.json();

        // answers is { questionNo: answerText }
        if (!answers || typeof answers !== 'object') {
            return NextResponse.json({ error: '回答データが不正です' }, { status: 400 });
        }

        // Get current max version
        const latestVersion = await prisma.storyVersion.findFirst({
            where: { userId: user.id },
            orderBy: { version: 'desc' },
        });

        const newVersion = (latestVersion?.version ?? 0) + 1;

        // Create new story version with answers
        await prisma.storyVersion.create({
            data: {
                userId: user.id,
                version: newVersion,
                note: note || null,
                answers: {
                    create: Object.entries(answers)
                        .filter(([, text]) => text && (text as string).trim() !== '')
                        .map(([qNo, text]) => ({
                            questionNo: parseInt(qNo),
                            answerText: text as string,
                        })),
                },
            },
        });

        return NextResponse.json({ success: true, version: newVersion });
    } catch (error) {
        console.error('Story save error:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
}
