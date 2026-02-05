import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

interface Props {
    params: Promise<{ userId: string }>;
}

export async function POST(request: NextRequest, { params }: Props) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await params;

    try {
        const { isActive } = await request.json();

        // Don't allow toggling admin users
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!targetUser) {
            return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
        }

        if (targetUser.role === 'ADMIN') {
            return NextResponse.json({ error: '管理者の状態は変更できません' }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: userId },
            data: { isActive },
        });

        // If deactivating, also delete their sessions
        if (!isActive) {
            await prisma.session.deleteMany({
                where: { userId },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Toggle user error:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
}
