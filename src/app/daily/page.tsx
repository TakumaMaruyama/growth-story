'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Nav from '@/components/Nav';

interface UserInfo {
    displayName: string;
}

interface LogData {
    score: number;
    practiced: boolean;
    goodText: string;
    improveText: string;
    tomorrowText: string;
}

function DailyLogPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const dateParam = searchParams.get('date');

    const [user, setUser] = useState<UserInfo | null>(null);
    const [date, setDate] = useState(dateParam || '');
    const [log, setLog] = useState<LogData>({
        score: 5,
        practiced: false,
        goodText: '',
        improveText: '',
        tomorrowText: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const fetchLog = useCallback(async (targetDate: string) => {
        try {
            const res = await fetch(`/api/daily?date=${targetDate}`);
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                if (data.log) {
                    setLog({
                        score: data.log.score,
                        practiced: data.log.practiced,
                        goodText: data.log.goodText || '',
                        improveText: data.log.improveText || '',
                        tomorrowText: data.log.tomorrowText || '',
                    });
                } else {
                    setLog({
                        score: 5,
                        practiced: false,
                        goodText: '',
                        improveText: '',
                        tomorrowText: '',
                    });
                }
                if (!date) setDate(data.today);
            } else if (res.status === 401) {
                router.push('/login');
            }
        } catch {
            setError('データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [router, date]);

    useEffect(() => {
        fetchLog(dateParam || '');
    }, [dateParam, fetchLog]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        setError('');

        try {
            const res = await fetch('/api/daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, ...log }),
            });

            if (res.ok) {
                setMessage('保存しました');
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
            <div className="container" style={{ maxWidth: '600px' }}>
                <h1 className="page-title">日誌入力</h1>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="date" className="form-label">日付</label>
                        <input
                            type="date"
                            id="date"
                            className="form-input"
                            value={date}
                            onChange={(e) => {
                                setDate(e.target.value);
                                fetchLog(e.target.value);
                            }}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="score" className="form-label">今日の点数 (1〜10)</label>
                        <input
                            type="range"
                            id="score"
                            min="1"
                            max="10"
                            value={log.score}
                            onChange={(e) => setLog({ ...log, score: parseInt(e.target.value) })}
                            style={{ width: '100%' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem' }}>
                            <span>1</span>
                            <span style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>{log.score}</span>
                            <span>10</span>
                        </div>
                        <div className="score-guide">
                            1-3: あまり良くない日 / 4-6: 普通の日 / 7-8: 良い日 / 9-10: 最高の日
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                checked={log.practiced}
                                onChange={(e) => setLog({ ...log, practiced: e.target.checked })}
                            />
                            今日は練習した
                        </label>
                    </div>

                    <div className="form-group">
                        <label htmlFor="goodText" className="form-label">良かったこと・できたこと</label>
                        <textarea
                            id="goodText"
                            className="form-textarea"
                            value={log.goodText}
                            onChange={(e) => setLog({ ...log, goodText: e.target.value })}
                            placeholder="今日頑張れたこと、うまくいったことを書こう"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="improveText" className="form-label">改善したいこと・課題</label>
                        <textarea
                            id="improveText"
                            className="form-textarea"
                            value={log.improveText}
                            onChange={(e) => setLog({ ...log, improveText: e.target.value })}
                            placeholder="もっと良くしたいこと、次に気をつけたいこと"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="tomorrowText" className="form-label">明日の目標</label>
                        <textarea
                            id="tomorrowText"
                            className="form-textarea"
                            value={log.tomorrowText}
                            onChange={(e) => setLog({ ...log, tomorrowText: e.target.value })}
                            placeholder="明日チャレンジしたいこと"
                        />
                    </div>

                    {message && <p className="success-message">{message}</p>}
                    {error && <p className="error-message">{error}</p>}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        disabled={saving}
                    >
                        {saving ? '保存中...' : '保存する'}
                    </button>
                </form>
            </div>
        </>
    );
}

export default function DailyLogPage() {
    return (
        <Suspense
            fallback={
                <>
                    <Nav />
                    <div className="container">
                        <p>読み込み中...</p>
                    </div>
                </>
            }
        >
            <DailyLogPageContent />
        </Suspense>
    );
}
