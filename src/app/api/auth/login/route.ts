import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const { loginId, password } = await request.json();

        if (!loginId || !password) {
            return NextResponse.json(
                { error: 'ログインIDとパスワードを入力してください' },
                { status: 400 }
            );
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { loginId },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'ログインIDまたはパスワードが正しくありません' },
                { status: 401 }
            );
        }

        // Check if active
        if (!user.isActive) {
            return NextResponse.json(
                { error: 'このアカウントは無効です' },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
            return NextResponse.json(
                { error: 'ログインIDまたはパスワードが正しくありません' },
                { status: 401 }
            );
        }

        // Create session
        const token = await createSession(user.id);
        await setSessionCookie(token);

        return NextResponse.json({
            success: true,
            role: user.role,
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'サーバーエラーが発生しました' },
            { status: 500 }
        );
    }
}
