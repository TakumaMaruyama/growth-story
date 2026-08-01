import { notFound } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import { requireAdmin } from '@/lib/auth';
import { formatJSTDateTime, formatJSTDisplay } from '@/lib/date';
import { prisma } from '@/lib/prisma';

interface Props {
    params: Promise<{ userId: string }>;
}

const GOAL_LABELS = {
    NEXT_MEET: '次の大会',
    ANNUAL: '年間目標',
    MILESTONE: '期限つき目標',
} as const;

export default async function AdminUserGoalsPage({ params }: Props) {
    const { userId } = await params;
    const admin = await requireAdmin(`/admin/users/${encodeURIComponent(userId)}/goals`);

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true },
    });
    if (!targetUser) notFound();

    const goals = await prisma.competitionGoal.findMany({
        where: { userId },
        orderBy: [
            { isActive: 'desc' },
            { targetDate: 'asc' },
            { updatedAt: 'desc' },
        ],
        select: {
            id: true,
            type: true,
            title: true,
            details: true,
            targetDate: true,
            isActive: true,
            archivedAt: true,
            updatedAt: true,
        },
    });

    await prisma.adminAuditEvent.create({
        data: {
            actorId: admin.id,
            targetUserId: targetUser.id,
            action: 'COMPETITION_GOALS_VIEWED',
        },
    });

    const activeGoals = goals.filter((goal) => goal.isActive);
    const archivedGoals = goals.filter((goal) => !goal.isActive);

    const renderGoal = (goal: (typeof goals)[number]) => (
        <article key={goal.id} className="summary-item stack">
            <div>
                <div className="button-row" style={{ justifyContent: 'space-between' }}>
                    <p className="eyebrow">{GOAL_LABELS[goal.type]}</p>
                    <span className={`badge ${goal.isActive ? 'badge-primary' : 'badge-secondary'}`}>
                        {goal.isActive ? '設定中' : '過去の目標'}
                    </span>
                </div>
                <h3 className="question-title">{goal.title}</h3>
                {goal.targetDate && (
                    <p className="muted">
                        {goal.type === 'ANNUAL'
                            ? `${goal.targetDate.getUTCFullYear()}年`
                            : `${formatJSTDisplay(goal.targetDate)}${goal.type === 'MILESTONE' ? 'まで' : ''}`}
                    </p>
                )}
            </div>
            {goal.details && <p style={{ whiteSpace: 'pre-wrap' }}>{goal.details}</p>}
            <p className="muted">
                最終更新 {formatJSTDateTime(goal.updatedAt)}
                {goal.archivedAt && `・移動 ${formatJSTDateTime(goal.archivedAt)}`}
            </p>
        </article>
    );

    return (
        <>
            <Nav userName={admin.displayName} isAdmin />
            <main id="main-content" className="container">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">Competition goals</p>
                        <h1 className="page-title">{targetUser.displayName}の大会目標</h1>
                        <p className="muted">設定中の目標と、過去へ移した目標を読み取り専用で確認します。</p>
                    </div>
                    <Link href={`/admin/users/${userId}`} className="btn btn-secondary">ユーザー詳細に戻る</Link>
                </div>

                <section className="card" aria-labelledby="active-goals-heading">
                    <h2 id="active-goals-heading" className="section-title">設定中の目標</h2>
                    {activeGoals.length > 0 ? (
                        <div className="summary-grid">{activeGoals.map(renderGoal)}</div>
                    ) : (
                        <p className="empty-state">設定中の大会目標はありません。</p>
                    )}
                </section>

                <section className="card" aria-labelledby="archived-goals-heading">
                    <h2 id="archived-goals-heading" className="section-title">過去の目標</h2>
                    {archivedGoals.length > 0 ? (
                        <div className="summary-grid">{archivedGoals.map(renderGoal)}</div>
                    ) : (
                        <p className="empty-state">過去へ移した大会目標はありません。</p>
                    )}
                </section>
            </main>
        </>
    );
}
