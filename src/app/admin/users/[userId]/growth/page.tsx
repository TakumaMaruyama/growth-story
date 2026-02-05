import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDisplay } from '@/lib/date';
import { predictAdultHeight, estimatePHV } from '@/lib/growth';
import Nav from '@/components/Nav';

interface Props {
    params: Promise<{ userId: string }>;
}

export default async function AdminUserGrowthPage({ params }: Props) {
    const admin = await requireAdmin();
    const { userId } = await params;

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!targetUser) {
        notFound();
    }

    // Get profile
    const profile = await prisma.growthProfile.findUnique({
        where: { userId },
    });

    // Get measurements
    const measurements = await prisma.growthMeasurement.findMany({
        where: { userId },
        orderBy: { measuredOn: 'desc' },
    });

    // Calculate prediction if possible
    let prediction = null;
    let phvResult = null;

    if (profile && measurements.length > 0) {
        const latest = measurements[0];
        prediction = predictAdultHeight({
            sex: profile.sex,
            birthDate: profile.birthDate,
            measurementDate: latest.measuredOn,
            heightCm: latest.heightCm,
            weightKg: latest.weightKg,
            fatherHeightCm: profile.fatherHeightCm,
            motherHeightCm: profile.motherHeightCm,
        });

        if (measurements.length >= 3) {
            phvResult = estimatePHV(
                measurements.map((m) => ({
                    measuredOn: m.measuredOn,
                    heightCm: m.heightCm,
                }))
            );
        }
    }

    return (
        <>
            <Nav userName={admin.displayName} isAdmin />
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>{targetUser.displayName}の成長記録</h1>
                    <Link href={`/admin/users/${userId}`} className="btn btn-secondary">ユーザー詳細に戻る</Link>
                </div>

                {/* Profile */}
                <div className="card">
                    <h2 className="section-title">👤 プロフィール</h2>
                    {profile ? (
                        <div>
                            <p>性別: <strong>{profile.sex === 'MALE' ? '男子' : '女子'}</strong></p>
                            <p>生年月日: <strong>{formatJSTDisplay(profile.birthDate)}</strong></p>
                            <p>父の身長: {profile.fatherHeightCm ? `${profile.fatherHeightCm} cm` : '未設定'}</p>
                            <p>母の身長: {profile.motherHeightCm ? `${profile.motherHeightCm} cm` : '未設定'}</p>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--secondary)' }}>プロフィール未設定</p>
                    )}
                </div>

                {/* Prediction */}
                {profile && (
                    <div className="card">
                        <h2 className="section-title">📊 予測</h2>
                        {measurements.length > 0 ? (
                            <>
                                <div style={{ marginBottom: '0.5rem', padding: '0.75rem', background: 'var(--border)', borderRadius: '0.375rem' }}>
                                    <strong>推定最終身長 (KR法):</strong>
                                    {prediction?.status === 'success' ? (
                                        <span style={{ fontSize: '1.25rem', marginLeft: '0.5rem' }}>
                                            約 {prediction.predictedHeightCm} cm
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--secondary)', marginLeft: '0.5rem' }}>
                                            {prediction?.message || '計算できません'}
                                        </span>
                                    )}
                                </div>

                                <div style={{ padding: '0.75rem', background: 'var(--border)', borderRadius: '0.375rem' }}>
                                    <strong>PHV推定:</strong>
                                    {phvResult?.status === 'success' ? (
                                        <span style={{ marginLeft: '0.5rem' }}>
                                            {formatJSTDisplay(phvResult.phvDate)}頃 (約 {phvResult.phvVelocity} cm/月)
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--secondary)', marginLeft: '0.5rem' }}>
                                            {phvResult?.message || '3回以上の測定が必要です'}
                                        </span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <p style={{ color: 'var(--secondary)' }}>測定データなし</p>
                        )}
                    </div>
                )}

                {/* Measurements */}
                <div className="card">
                    <h2 className="section-title">📏 測定履歴</h2>
                    {measurements.length > 0 ? (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>測定日</th>
                                    <th>身長</th>
                                    <th>体重</th>
                                    <th>座高</th>
                                </tr>
                            </thead>
                            <tbody>
                                {measurements.map((m) => (
                                    <tr key={m.id}>
                                        <td>{formatJSTDisplay(m.measuredOn)}</td>
                                        <td>{m.heightCm} cm</td>
                                        <td>{m.weightKg ? `${m.weightKg} kg` : '-'}</td>
                                        <td>{m.sittingHeightCm ? `${m.sittingHeightCm} cm` : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ color: 'var(--secondary)' }}>測定記録がありません</p>
                    )}
                </div>
            </div>
        </>
    );
}
