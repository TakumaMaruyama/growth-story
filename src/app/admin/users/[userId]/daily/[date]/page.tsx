import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDisplay } from '@/lib/date';
import Nav from '@/components/Nav';

interface Props {
    params: Promise<{ userId: string; date: string }>;
}

export default async function AdminUserDailyDetailPage({ params }: Props) {
    const admin = await requireAdmin();
    const { userId, date } = await params;

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!targetUser) {
        notFound();
    }

    const log = await prisma.dailyLog.findUnique({
        where: {
            userId_logDate: {
                userId,
                logDate: new Date(date),
            },
        },
    });

    if (!log) {
        notFound();
    }

    return (
        <>
            <Nav userName={admin.displayName} isAdmin />
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>
                        {targetUser.displayName}の日誌 ({formatJSTDisplay(log.logDate)})
                    </h1>
                    <Link href={`/admin/users/${userId}/daily`} className="btn btn-secondary">一覧に戻る</Link>
                </div>

                <div className="card">
                    <div style={{ marginBottom: '1rem' }}>
                        <strong>点数:</strong> {log.score}/10
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <strong>練習:</strong> {log.practiced ? '✅ あり' : '❌ なし'}
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <strong>良かったこと・できたこと:</strong>
                        <p style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                            {log.goodText || <span style={{ color: 'var(--secondary)' }}>記入なし</span>}
                        </p>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <strong>改善したいこと・課題:</strong>
                        <p style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                            {log.improveText || <span style={{ color: 'var(--secondary)' }}>記入なし</span>}
                        </p>
                    </div>

                    <div>
                        <strong>明日の目標:</strong>
                        <p style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                            {log.tomorrowText || <span style={{ color: 'var(--secondary)' }}>記入なし</span>}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
