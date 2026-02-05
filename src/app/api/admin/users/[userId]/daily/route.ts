import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

interface Props {
    params: Promise<{ userId: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const where: { userId: string; logDate?: { gte?: Date; lte?: Date } } = { userId };

    if (from || to) {
        where.logDate = {};
        if (from) where.logDate.gte = new Date(from);
        if (to) where.logDate.lte = new Date(to);
    }

    const logs = await prisma.dailyLog.findMany({
        where,
        orderBy: { logDate: 'desc' },
    });

    return NextResponse.json({
        adminUser: { displayName: user.displayName },
        targetUser: { id: targetUser.id, displayName: targetUser.displayName },
        logs,
    });
}
