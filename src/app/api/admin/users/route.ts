import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, hashPassword } from '@/lib/auth';

export async function GET() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            loginId: true,
            displayName: true,
            role: true,
            isActive: true,
            createdAt: true,
        },
    });

    return NextResponse.json({
        adminUser: { displayName: user.displayName },
        users,
    });
}

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { loginId, displayName, password } = await request.json();

        if (!loginId || !displayName || !password) {
            return NextResponse.json({ error: '全ての項目を入力してください' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'パスワードは6文字以上で入力してください' }, { status: 400 });
        }

        // Check if login_id exists
        const existing = await prisma.user.findUnique({
            where: { loginId },
        });

        if (existing) {
            return NextResponse.json({ error: 'このログインIDは既に使用されています' }, { status: 400 });
        }

        const passwordHash = await hashPassword(password);

        await prisma.user.create({
            data: {
                loginId,
                displayName,
                passwordHash,
                role: 'USER',
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('User create error:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
}
