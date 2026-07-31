import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDisplay, parseDateOnly } from '@/lib/date';
import Nav from '@/components/Nav';

interface Props {
    params: Promise<{ userId: string; date: string }>;
}

export default async function AdminUserDailyDetailPage({ params }: Props) {
    const admin = await requireAdmin();
    const { userId, date } = await params;
    const logDate = parseDateOnly(date);
    if (!logDate) notFound();

    const [targetUser, log] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { displayName: true },
        }),
        prisma.dailyLog.findUnique({
            where: { userId_logDate: { userId, logDate } },
        }),
    ]);
    if (!targetUser || !log) notFound();

    const sections = [
        { title: '良かったこと・できたこと', value: log.goodText },
        { title: '次に良くしたいこと', value: log.improveText },
        { title: '次の練習で意識すること', value: log.tomorrowText },
    ];

    return (
        <>
            <Nav userName={admin.displayName} isAdmin />
            <main id="main-content" className="container container-narrow">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">Daily log</p>
                        <h1 className="page-title">{targetUser.displayName}の日誌</h1>
                        <p className="muted">{formatJSTDisplay(log.logDate)}</p>
                    </div>
                    <Link href={`/admin/users/${userId}/daily`} className="btn btn-secondary">一覧に戻る</Link>
                </div>

                <section className="card" aria-labelledby="overview-heading">
                    <h2 id="overview-heading" className="section-title">この日の記録</h2>
                    <dl className="detail-list">
                        <dt>自己評価</dt>
                        <dd><strong>{log.score}/10</strong></dd>
                        <dt>練習</dt>
                        <dd>{log.practiced ? 'あり' : 'なし'}</dd>
                    </dl>
                </section>

                {sections.map((section) => (
                    <section key={section.title} className="card">
                        <h2 className="section-title">{section.title}</h2>
                        <p style={{ whiteSpace: 'pre-wrap' }}>
                            {section.value || <span className="muted">記入なし</span>}
                        </p>
                    </section>
                ))}
            </main>
        </>
    );
}
