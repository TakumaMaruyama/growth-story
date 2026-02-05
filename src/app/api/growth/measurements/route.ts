import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const measurements = await prisma.growthMeasurement.findMany({
        where: { userId: user.id },
        orderBy: { measuredOn: 'desc' },
    });

    return NextResponse.json({
        user: { displayName: user.displayName },
        measurements,
    });
}

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { measuredOn, heightCm, weightKg, sittingHeightCm } = await request.json();

        if (!measuredOn || !heightCm) {
            return NextResponse.json({ error: '測定日と身長は必須です' }, { status: 400 });
        }

        const measuredOnDate = new Date(measuredOn);

        // Upsert measurement (same date replaces)
        await prisma.growthMeasurement.upsert({
            where: {
                userId_measuredOn: {
                    userId: user.id,
                    measuredOn: measuredOnDate,
                },
            },
            update: {
                heightCm,
                weightKg: weightKg ?? null,
                sittingHeightCm: sittingHeightCm ?? null,
            },
            create: {
                userId: user.id,
                measuredOn: measuredOnDate,
                heightCm,
                weightKg: weightKg ?? null,
                sittingHeightCm: sittingHeightCm ?? null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Measurement save error:', error);
        return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
}
