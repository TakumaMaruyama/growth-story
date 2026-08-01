import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDisplay } from '@/lib/date';
import Nav from '@/components/Nav';

interface Props {
    params: Promise<{ userId: string }>;
}

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
                isActive: true,
                createdAt: true,
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
            select: { logDate: true, score: true, practiced: true },
        }),
        prisma.competitionGoal.findMany({
            where: { userId, isActive: true },
            orderBy: [{ targetDate: 'asc' }, { updatedAt: 'desc' }],
            select: { id: true, type: true, title: true, targetDate: true },
        }),
    ]);

    if (!targetUser) notFound();
    const primaryGoal = activeGoals[0];

    return (
        <>
            <Nav userName={admin.displayName} isAdmin />
            <main id="main-content" className="container">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">User details</p>
                        <h1 className="page-title">{targetUser.displayName}</h1>
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
                            <dt>表示名</dt>
                            <dd><strong>{targetUser.displayName}</strong></dd>
                            <dt>状態</dt>
                            <dd>
                                <span className={`badge ${targetUser.isActive ? 'badge-primary' : 'badge-secondary'}`}>
                                    {targetUser.isActive ? '有効' : '無効'}
                                </span>
                            </dd>
                            <dt>登録日</dt>
                            <dd>{formatJSTDisplay(targetUser.createdAt)}</dd>
                        </dl>
                    </section>

                    <section className="card" aria-labelledby="summary-heading">
                        <h2 id="summary-heading" className="section-title">記録サマリー</h2>
                        <div className="summary-grid">
                            <div>
                                <p className="summary-label">日誌</p>
                                <p className="summary-value">{targetUser._count.dailyLogs}</p>
                            </div>
                            <div>
                                <p className="summary-label">物語の更新</p>
                                <p className="summary-value">{targetUser._count.storyVersions}</p>
                            </div>
                            <div>
                                <p className="summary-label">大会目標</p>
                                <p className="summary-value">{targetUser._count.competitionGoals}</p>
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
                                    <p className="muted">自己評価 {latestDailyLog.score}/10・練習{latestDailyLog.practiced ? 'あり' : 'なし'}</p>
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
                        <div className="summary-item">
                            <h3 className="question-title">大会目標</h3>
                            {primaryGoal ? (
                                <>
                                    <p>{primaryGoal.title}</p>
                                    <p className="muted">
                                        有効な目標 {activeGoals.length}件
                                        {primaryGoal.targetDate && `・${formatJSTDisplay(primaryGoal.targetDate)}まで`}
                                    </p>
                                </>
                            ) : <p className="muted">記録なし</p>}
                        </div>
                    </div>
                </section>

                <section className="card" aria-labelledby="details-heading">
                    <h2 id="details-heading" className="section-title">詳細を見る</h2>
                    <div className="button-row">
                        <Link href={`/admin/users/${userId}/daily`} className="btn btn-secondary">日誌一覧</Link>
                        <Link href={`/admin/users/${userId}/story`} className="btn btn-secondary">物語履歴</Link>
                        <Link href={`/admin/users/${userId}/goals`} className="btn btn-secondary">大会目標</Link>
                    </div>
                </section>
            </main>
        </>
    );
}
