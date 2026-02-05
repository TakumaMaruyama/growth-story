'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';

interface UserInfo {
    displayName: string;
}

interface Measurement {
    id: string;
    measuredOn: string;
    heightCm: number;
    weightKg: number | null;
    sittingHeightCm: number | null;
}

export default function MeasurementsPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [measurements, setMeasurements] = useState<Measurement[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // Form state
    const [measuredOn, setMeasuredOn] = useState('');
    const [heightCm, setHeightCm] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [sittingHeightCm, setSittingHeightCm] = useState('');

    const fetchData = async () => {
        try {
            const res = await fetch('/api/growth/measurements');
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                setMeasurements(data.measurements);
            } else if (res.status === 401) {
                router.push('/login');
            }
        } catch {
            setError('データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setMessage('');

        try {
            const res = await fetch('/api/growth/measurements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    measuredOn,
                    heightCm: parseFloat(heightCm),
                    weightKg: weightKg ? parseFloat(weightKg) : null,
                    sittingHeightCm: sittingHeightCm ? parseFloat(sittingHeightCm) : null,
                }),
            });

            if (res.ok) {
                setMessage('保存しました');
                setMeasuredOn('');
                setHeightCm('');
                setWeightKg('');
                setSittingHeightCm('');
                fetchData();
            } else {
                const data = await res.json();
                setError(data.error || '保存に失敗しました');
            }
        } catch {
            setError('通信エラーが発生しました');
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    };

    if (loading) {
        return (
            <>
                <Nav userName={user?.displayName} />
                <div className="container">
                    <p>読み込み中...</p>
                </div>
            </>
        );
    }

    return (
        <>
            <Nav userName={user?.displayName} />
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>測定管理</h1>
                    <Link href="/growth" className="btn btn-secondary">成長トップに戻る</Link>
                </div>

                {/* Add Measurement Form */}
                <div className="card">
                    <h2 className="section-title">新しい測定を追加</h2>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="measuredOn" className="form-label">測定日</label>
                                <input
                                    type="date"
                                    id="measuredOn"
                                    className="form-input"
                                    value={measuredOn}
                                    onChange={(e) => setMeasuredOn(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="heightCm" className="form-label">身長 (cm)</label>
                                <input
                                    type="number"
                                    id="heightCm"
                                    className="form-input"
                                    value={heightCm}
                                    onChange={(e) => setHeightCm(e.target.value)}
                                    required
                                    step="0.1"
                                    min="50"
                                    max="250"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="weightKg" className="form-label">体重 (kg) - 任意</label>
                                <input
                                    type="number"
                                    id="weightKg"
                                    className="form-input"
                                    value={weightKg}
                                    onChange={(e) => setWeightKg(e.target.value)}
                                    step="0.1"
                                    min="10"
                                    max="200"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="sittingHeightCm" className="form-label">座高 (cm) - 任意</label>
                                <input
                                    type="number"
                                    id="sittingHeightCm"
                                    className="form-input"
                                    value={sittingHeightCm}
                                    onChange={(e) => setSittingHeightCm(e.target.value)}
                                    step="0.1"
                                    min="30"
                                    max="150"
                                />
                            </div>
                        </div>

                        {message && <p className="success-message" style={{ marginTop: '0.5rem' }}>{message}</p>}
                        {error && <p className="error-message" style={{ marginTop: '0.5rem' }}>{error}</p>}

                        <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={saving}>
                            {saving ? '保存中...' : '追加する'}
                        </button>
                    </form>
                </div>

                {/* Measurements List */}
                <div className="card">
                    <h2 className="section-title">測定履歴</h2>
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
                                        <td>{formatDate(m.measuredOn)}</td>
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
