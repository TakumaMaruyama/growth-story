import { notFound } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import { requireAdmin } from '@/lib/auth';
import {
    findNextMeetGoalId,
    getCompetitionGoalDisplayValues,
    isCompetitionGoalElapsed,
    sortCompetitionGoalsForDisplay,
} from '@/lib/competition-goal-display';
import { formatJSTDateTime, formatJSTDisplay, todayJST } from '@/lib/date';
import { prisma } from '@/lib/prisma';
import { getUserFullName } from '@/lib/user-name';

interface Props {
    params: Promise<{ userId: string }>;
}

const GOAL_LABELS = {
    NEXT_MEET: '大会',
    ANNUAL: '年間',
    MILESTONE: '出場目標',
} as const;

export default async function AdminUserGoalsPage({ params }: Props) {
    const { userId } = await params;
    const admin = await requireAdmin(`/admin/users/${encodeURIComponent(userId)}/goals`);

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, familyName: true, givenName: true },
    });
    if (!targetUser) notFound();
    const targetFullName = getUserFullName(targetUser);

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

    const today = todayJST();
    const activeGoals = sortCompetitionGoalsForDisplay(
        goals.filter((goal) => goal.isActive),
        today,
    );
    const archivedGoals = goals
        .filter((goal) => !goal.isActive)
        .sort((left, right) => (
            (right.archivedAt?.getTime() ?? 0) - (left.archivedAt?.getTime() ?? 0)
        ));
    const nextMeetGoalId = findNextMeetGoalId(activeGoals, today);

    const renderGoal = (goal: (typeof goals)[number]) => {
        const displayGoal = getCompetitionGoalDisplayValues(goal);
        const target = goal.targetDate
            ? goal.type === 'ANNUAL'
                ? `${goal.targetDate.getUTCFullYear()}年`
                : `${formatJSTDisplay(goal.targetDate)}${goal.type === 'MILESTONE' ? 'まで' : ''}`
            : '未設定';
        const isElapsed = isCompetitionGoalElapsed(goal, today);
        return (
            <article
                key={goal.id}
                id={`goal-${goal.id}`}
                className="summary-item stack admin-goal-target"
            >
                <div className="goal-list-badges">
                    <p className="eyebrow">{GOAL_LABELS[goal.type]}</p>
                    <span className={`badge ${goal.isActive ? 'badge-primary' : 'badge-secondary'}`}>
                        {goal.isActive ? '設定中' : '過去の目標'}
                    </span>
                    {goal.isActive && goal.id === nextMeetGoalId && (
                        <span className="badge badge-primary">次の大会</span>
                    )}
                    {goal.isActive && !goal.targetDate && (
                        <span className="badge badge-secondary">日付未定</span>
                    )}
                    {goal.isActive && isElapsed && (
                        <span className="badge badge-secondary">経過済み</span>
                    )}
                </div>
                <dl className="goal-display-list">
                    <div>
                        <dt>大会名</dt>
                        <dd>{displayGoal.meetName || '未設定'}</dd>
                    </div>
                    <div>
                        <dt>日付</dt>
                        <dd>{target}</dd>
                    </div>
                    <div>
                        <dt>目標</dt>
                        <dd>{displayGoal.goalText || '未設定'}</dd>
                    </div>
                </dl>
                <p className="muted">
                    最終更新 {formatJSTDateTime(goal.updatedAt)}
                    {goal.archivedAt && `・移動 ${formatJSTDateTime(goal.archivedAt)}`}
                </p>
            </article>
        );
    };

    return (
        <>
            <Nav userName={admin.displayName} isAdmin />
            <main id="main-content" className="container">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">Competition goals</p>
                        <h1 className="page-title">{targetFullName}の大会目標</h1>
                        <p className="muted">設定中の目標と、過去へ移した目標を読み取り専用で確認します。</p>
                    </div>
                    <Link href={`/admin/users/${userId}`} className="btn btn-secondary">ユーザー詳細に戻る</Link>
                </div>

                <section className="card" aria-labelledby="active-goals-heading">
                    <h2 id="active-goals-heading" className="section-title">設定中の目標</h2>
                    <p className="muted">設定中 {activeGoals.length}件・これからの日付が近い順に表示しています。</p>
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
