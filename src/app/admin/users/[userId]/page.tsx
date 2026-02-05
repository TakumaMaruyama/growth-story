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
    const admin = await requireAdmin();
    const { userId } = await params;

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            growthProfile: true,
            _count: {
                select: {
                    dailyLogs: true,
                    storyVersions: true,
                    growthMeasurements: true,
                },
            },
        },
    });

    if (!targetUser) {
        notFound();
    }

    // Get latest story
    const latestStory = await prisma.storyVersion.findFirst({
        where: { userId },
        orderBy: { version: 'desc' },
    });

    // Get latest measurement
    const latestMeasurement = await prisma.growthMeasurement.findFirst({
        where: { userId },
        orderBy: { measuredOn: 'desc' },
    });

    return (
        <>
            <Nav userName={admin.displayName} isAdmin />
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>ユーザー詳細</h1>
                    <Link href="/admin/users" className="btn btn-secondary">一覧に戻る</Link>
                </div>

                {/* User Info */}
                <div className="card">
                    <h2 className="section-title">👤 基本情報</h2>
                    <p>ログインID: <strong>{targetUser.loginId}</strong></p>
                    <p>表示名: <strong>{targetUser.displayName}</strong></p>
                    <p>状態: <span className={`badge ${targetUser.isActive ? 'badge-primary' : 'badge-secondary'}`}>
                        {targetUser.isActive ? '有効' : '無効'}
                    </span></p>
                    <p>登録日: {formatJSTDisplay(targetUser.createdAt)}</p>
                </div>

                {/* Summary */}
                <div className="card">
                    <h2 className="section-title">📊 サマリ</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        <div>
                            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>日誌エントリ</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{targetUser._count.dailyLogs}</p>
                        </div>
                        <div>
                            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>物語バージョン</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{targetUser._count.storyVersions}</p>
                        </div>
                        <div>
                            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>測定回数</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{targetUser._count.growthMeasurements}</p>
                        </div>
                    </div>
                </div>

                {/* Latest Data */}
                <div className="card">
                    <h2 className="section-title">📝 最新データ</h2>

                    <div style={{ marginBottom: '1rem' }}>
                        <strong>物語:</strong>
                        {latestStory ? (
                            <span> Ver.{latestStory.version} ({formatJSTDisplay(latestStory.createdAt)})</span>
                        ) : (
                            <span style={{ color: 'var(--secondary)' }}> なし</span>
                        )}
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <strong>身長:</strong>
                        {latestMeasurement ? (
                            <span> {latestMeasurement.heightCm} cm ({formatJSTDisplay(latestMeasurement.measuredOn)})</span>
                        ) : (
                            <span style={{ color: 'var(--secondary)' }}> なし</span>
                        )}
                    </div>

                    {targetUser.growthProfile && (
                        <div>
                            <strong>プロフィール:</strong>
                            <span> {targetUser.growthProfile.sex === 'MALE' ? '男子' : '女子'}</span>
                            <span>, 生年月日: {formatJSTDisplay(targetUser.growthProfile.birthDate)}</span>
                        </div>
                    )}
                </div>

                {/* Links to detail pages */}
                <div className="card">
                    <h2 className="section-title">🔗 詳細閲覧</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Link href={`/admin/users/${userId}/story`} className="btn btn-secondary">物語履歴</Link>
                        <Link href={`/admin/users/${userId}/daily`} className="btn btn-secondary">日誌一覧</Link>
                        <Link href={`/admin/users/${userId}/growth`} className="btn btn-secondary">成長記録</Link>
                    </div>
                </div>
            </div>
        </>
    );
}
