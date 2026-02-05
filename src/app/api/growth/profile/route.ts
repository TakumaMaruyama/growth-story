import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { sex, birthDate, fatherHeightCm, motherHeightCm } = await request.json();

        if (!sex || !birthDate) {
            return NextResponse.json({ error: '性別と生年月日は必須です' }, { status: 400 });
        }

        if (sex !== 'MALE' && sex !== 'FEMALE') {
            return NextResponse.json({ error: '性別が不正です' }, { status: 400 });
        }

        // Upsert profile
        await prisma.growthProfile.upsert({
            where: { userId: user.id },
            update: {
                sex,
                birthDate: new Date(birthDate),
                fatherHeightCm: fatherHeightCm ?? null,
                motherHeightCm: motherHeightCm ?? null,
            },
            create: {
                userId: user.id,
                sex,
                birthDate: new Date(birthDate),
                fatherHeightCm: fatherHeightCm ?? null,
                motherHeightCm: motherHeightCm ?? null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Profile save error:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
}
