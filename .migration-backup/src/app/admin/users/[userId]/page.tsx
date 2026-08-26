import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDateTime, formatJSTDisplay, todayJST } from '@/lib/date';
import { getDailyActivityLabel } from '@/lib/daily-activity';
import {
    getCompetitionGoalDisplayValues,
    sortCompetitionGoalsForDisplay,
} from '@/lib/competition-goal-display';
import Nav from '@/components/Nav';
import { getUserFullName, hasStructuredRealName } from '@/lib/user-name';

interface Props {
    params: Promise<{ userId: string }>;
}

const GOAL_LABELS = {
    NEXT_MEET: '大会',
    ANNUAL: '年間',
    MILESTONE: '出場目標',
} as const;

export default async function AdminUserDetailPage({ params }: Props) {
    const { userId } = await params;
    const admin = await requireAdmin(`/admin/users/${encodeURIComponent(userId)}`);

    const [targetUser, latestStory, latestDailyLog, activeGoals] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                loginId: true,
                displayName: true,
                familyName: true,
                givenName: true,
                role: true,
                isActive: true,
                membershipStatus: true,
                withdrawnAt: true,
                createdAt: true,
                guardianConsent: {
                    select: {
                        guardianName: true,
                        guardianRelationship: true,
                        noticeVersion: true,
                        acceptedAt: true,
                    },
                },
                _count: { select: { dailyLogs: true, storyVersions: true, competitionGoals: true } },
            },
        }),
        prisma.storyVersion.findFirst({
            where: { userId },
            orderBy: { version: 'desc' },
            select: { version: true, createdAt: true },
        }),
        prisma.dailyLog.findFirst({
            where: { userId },
            orderBy: { logDate: 'desc' },
            select: { logDate: true, score: true, activityType: true },
        }),
        prisma.competitionGoal.findMany({
            where: { userId, isActive: true },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                type: true,
                title: true,
                details: true,
                targetDate: true,
                updatedAt: true,
            },
        }),
    ]);

    if (!targetUser) notFound();
    const targetFullName = getUserFullName(targetUser);
    const targetHasRealName = hasStructuredRealName(targetUser);
    const today = todayJST();
    const primaryGoal = sortCompetitionGoalsForDisplay(activeGoals, today)[0];
    const primaryGoalDisplay = primaryGoal
        ? getCompetitionGoalDisplayValues(primaryGoal)
        : null;
    const primaryGoalTarget = primaryGoal?.targetDate
        ? primaryGoal.type === 'ANNUAL'
            ? `${primaryGoal.targetDate.getUTCFullYear()}年`
            : `${formatJSTDisplay(primaryGoal.targetDate)}${primaryGoal.type === 'MILESTONE' ? 'まで' : ''}`
        : '日付未定';

    return (
        <>
            <Nav userName={admin.displayName} isAdmin />
            <main id="main-content" className="container">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">User details</p>
                        <h1 className="page-title">{targetFullName}</h1>
                        <p className="muted">ユーザーの記録状況と最新データを確認します。</p>
                    </div>
                    <Link href="/admin/users" className="btn btn-secondary">一覧に戻る</Link>
                </div>

                <div className="summary-grid">
                    <section className="card" aria-labelledby="profile-heading">
                        <h2 id="profile-heading" className="section-title">基本情報</h2>
                        <dl className="detail-list">
                            <dt>ログインID</dt>
                            <dd><strong>{targetUser.loginId}</strong></dd>
                            <dt>選手氏名（本名）</dt>
                            <dd>
                                <strong>{targetFullName}</strong>
                                {targetUser.role === 'USER' && !targetHasRealName && (
                                    <><br /><span className="muted">本名未登録の既存会員</span></>
                                )}
                            </dd>
                            <dt>本人画面の表示</dt>
                            <dd><strong>{targetUser.displayName}</strong></dd>
                            <dt>会員状態</dt>
                            <dd>
                                <span className={`badge ${targetUser.membershipStatus === 'ACTIVE' ? 'badge-primary' : 'badge-secondary'}`}>
                                    {targetUser.membershipStatus === 'ACTIVE' ? '利用中' : '退会'}
                                </span>
                            </dd>
                            {targetUser.withdrawnAt && (
                                <>
                                    <dt>退会・同意撤回日</dt>
                                    <dd>{formatJSTDateTime(targetUser.withdrawnAt)}</dd>
                                </>
                            )}
                            <dt>ログイン</dt>
                            <dd>
                                <span className={`badge ${targetUser.isActive ? 'badge-primary' : 'badge-secondary'}`}>
                                    {targetUser.isActive ? '可能' : '停止'}
                                </span>
                            </dd>
                            <dt>登録日</dt>
                            <dd>{formatJSTDisplay(targetUser.createdAt)}</dd>
                            <dt>保護者同意</dt>
                            <dd>
                                {targetUser.guardianConsent ? (
                                    <>
                                        <strong>同意記録あり</strong><br />
                                        {targetUser.guardianConsent.guardianName}（{targetUser.guardianConsent.guardianRelationship}）<br />
                                        {formatJSTDateTime(targetUser.guardianConsent.acceptedAt)}・版 {targetUser.guardianConsent.noticeVersion}
                                    </>
                                ) : '記録なし（招待登録前の既存会員）'}
                            </dd>
                        </dl>
                    </section>

                    <section className="card" aria-labelledby="summary-heading">
                        <h2 id="summary-heading" className="section-title">記録サマリー</h2>
                        <div className="summary-grid">
                            <div>
                                <p className="summary-label">練習日誌</p>
                                <p className="summary-value">{targetUser._count.dailyLogs}</p>
                            </div>
                            <div>
                                <p className="summary-label">大会目標</p>
                                <p className="summary-value">{targetUser._count.competitionGoals}</p>
                            </div>
                            <div>
                                <p className="summary-label">競泳物語</p>
                                <p className="summary-value">{targetUser._count.storyVersions}</p>
                            </div>
                        </div>
                    </section>
                </div>

                <section className="card" aria-labelledby="latest-heading">
                    <h2 id="latest-heading" className="section-title">最新データ</h2>
                    <div className="summary-grid">
                        <div className="summary-item">
                            <h3 className="question-title">練習日誌</h3>
                            {latestDailyLog ? (
                                <>
                                    <p>{formatJSTDisplay(latestDailyLog.logDate)}</p>
                                    <p className="muted">自己評価 {latestDailyLog.score}/10・{getDailyActivityLabel(latestDailyLog.activityType)}</p>
                                </>
                            ) : <p className="muted">記録なし</p>}
                        </div>
                        <div className="summary-item">
                            <h3 className="question-title">大会目標</h3>
                            {primaryGoal ? (
                                <>
                                    <p>
                                        {primaryGoalDisplay?.meetName
                                            || primaryGoalDisplay?.goalText
                                            || GOAL_LABELS[primaryGoal.type]}
                                    </p>
                                    <p className="muted">
                                        {GOAL_LABELS[primaryGoal.type]}・{primaryGoalTarget}・設定中 {activeGoals.length}件
                                    </p>
                                    {primaryGoalDisplay?.meetName && primaryGoalDisplay.goalText && (
                                        <p className="muted">{primaryGoalDisplay.goalText}</p>
                                    )}
                                </>
                            ) : <p className="muted">記録なし</p>}
                        </div>
                        <div className="summary-item">
                            <h3 className="question-title">競泳物語</h3>
                            {latestStory ? (
                                <>
                                    <p>Ver.{latestStory.version}</p>
                                    <p className="muted">{formatJSTDisplay(latestStory.createdAt)} 更新</p>
                                </>
                            ) : <p className="muted">記録なし</p>}
                        </div>
                    </div>
                </section>

                <section className="card" aria-labelledby="details-heading">
                    <h2 id="details-heading" className="section-title">詳細を見る</h2>
                    <div className="button-row">
                        <Link href={`/admin/users/${userId}/daily`} className="btn btn-secondary">練習日誌一覧</Link>
                        <Link href={`/admin/users/${userId}/goals`} className="btn btn-secondary">大会目標</Link>
                        <Link href={`/admin/users/${userId}/story`} className="btn btn-secondary">競泳物語履歴</Link>
                    </div>
                </section>
            </main>
        </>
    );
}
