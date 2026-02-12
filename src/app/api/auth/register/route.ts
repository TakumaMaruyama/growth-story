import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, hashPassword, setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const loginId = (body.loginId ?? '').trim();
        const displayName = (body.displayName ?? '').trim();
        const password = body.password ?? '';

        if (!loginId || !displayName || !password) {
            return NextResponse.json(
                { error: 'ログインID、表示名、パスワードを入力してください' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'パスワードは6文字以上で入力してください' },
                { status: 400 }
            );
        }

        const existing = await prisma.user.findUnique({
            where: { loginId },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'このログインIDは既に使用されています' },
                { status: 400 }
            );
        }

        const passwordHash = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                loginId,
                displayName,
                passwordHash,
                role: 'USER',
                isActive: true,
            },
        });

        const token = await createSession(user.id);
        await setSessionCookie(token);

        return NextResponse.json({ success: true, role: user.role });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return NextResponse.json(
                { error: 'このログインIDは既に使用されています' },
                { status: 400 }
            );
        }

        console.error('Register error:', error);
        return NextResponse.json(
            { error: 'サーバーエラーが発生しました' },
            { status: 500 }
        );
    }
}
