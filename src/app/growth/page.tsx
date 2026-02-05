import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDisplay } from '@/lib/date';
import { predictAdultHeight, estimatePHV } from '@/lib/growth';
import Nav from '@/components/Nav';
import GrowthProfileForm from './GrowthProfileForm';

export default async function GrowthPage() {
    const user = await requireUser();

    if (user.role === 'ADMIN') {
        redirect('/admin/users');
    }

    // Get profile
    const profile = await prisma.growthProfile.findUnique({
        where: { userId: user.id },
    });

    // Get measurements
    const measurements = await prisma.growthMeasurement.findMany({
        where: { userId: user.id },
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

        // PHV estimation
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
            <Nav userName={user.displayName} />
            <div className="container">
                <h1 className="page-title">成長記録</h1>

                {/* Profile Section */}
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
                        <GrowthProfileForm />
                    )}
                </div>

                {/* Summary Section */}
                {profile && (
                    <div className="card">
                        <h2 className="section-title">📊 サマリ</h2>

                        {measurements.length > 0 ? (
                            <>
                                <p>
                                    最新身長: <strong style={{ fontSize: '1.25rem' }}>{measurements[0].heightCm} cm</strong>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--secondary)', marginLeft: '0.5rem' }}>
                                        ({formatJSTDisplay(measurements[0].measuredOn)})
                                    </span>
                                </p>
                                {measurements[0].weightKg && (
                                    <p>最新体重: <strong>{measurements[0].weightKg} kg</strong></p>
                                )}

                                {/* KR Prediction */}
                                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--border)', borderRadius: '0.375rem' }}>
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

                                {/* PHV */}
                                <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--border)', borderRadius: '0.375rem' }}>
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
                            <p style={{ color: 'var(--secondary)' }}>測定記録がありません</p>
                        )}

                        <div style={{ marginTop: '1rem' }}>
                            <Link href="/growth/measurements" className="btn btn-primary">測定を追加・管理</Link>
                        </div>
                    </div>
                )}

                {/* Disclaimer */}
                <div className="note-box">
                    <strong>⚠️ 注意事項</strong>
                    <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                        <li>推定値は統計モデルに基づくもので、実際の身長を保証するものではありません</li>
                        <li>元データは米国のデータセットに基づいており、日本人への適合が保証されるものではありません</li>
                        <li>医療的判断には利用しないでください</li>
                    </ul>
                </div>
            </div>
        </>
    );
}
