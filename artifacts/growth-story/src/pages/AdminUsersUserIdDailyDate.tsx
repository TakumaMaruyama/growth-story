import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { formatJSTDisplay, parseDateOnly } from '../lib/date';
import { getDailyActivityLabel } from '../lib/daily-activity';
import Nav from '../components/Nav';
import { loginHref } from '../lib/return-path';

export default function AdminUserDailyDate({ params }: { params: { userId: string, date: string } }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [, setLocation] = useLocation();
    const encodedUserId = encodeURIComponent(params.userId);
    const encodedDate = encodeURIComponent(params.date);

    useEffect(() => {
        const loadDailyDate = async () => {
            try {
                const response = await fetch(`/api/admin/users/${encodedUserId}/daily/${encodedDate}`, { credentials: 'include' });
                if (response.status === 401) {
                    setLocation(loginHref(`${window.location.pathname}${window.location.search}`, 'admin'));
                    return;
                }
                if (response.status === 403) {
                    setLocation('/admin/users');
                    return;
                }
                if (response.status === 404) {
                    setError('日誌が見つかりません');
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to load daily log');
                }
                const json = await response.json();
                setData(json);
            } catch (err) {
                setError('データの読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        loadDailyDate();
    }, [encodedUserId, encodedDate, setLocation]);

    if (loading) {
        return <><Nav isAdmin /><main className="container"><div className="loading-state">読み込み中...</div></main></>;
    }
    if (error || !data) {
        return <><Nav isAdmin /><main className="container"><div className="alert alert-danger">{error}</div></main></>;
    }

    const { targetUser, log } = data;
    const dateObj = parseDateOnly(params.date);

    return (
        <>
            <Nav isAdmin />
            <main id="main-content" className="container">
                <header className="page-header">
                    <div>
                        <p className="eyebrow">{targetUser.displayName} さんの記録</p>
                        <h1 className="page-title">{dateObj ? formatJSTDisplay(dateObj) : params.date} の練習日誌</h1>
                    </div>
                    <div className="button-row">
                        <Link href={`/admin/users/${encodeURIComponent(targetUser.id)}`} className="btn btn-secondary">
                            ユーザー詳細へ戻る
                        </Link>
                    </div>
                </header>

                <div className="card">
                    {log ? (
                        <div className="stack">
                            <p>自己評価: <strong>{log.score}/10</strong></p>
                            <p>区分: {getDailyActivityLabel(log.activityType)}</p>
                            
                            <h3 className="section-title" style={{ marginTop: '1rem' }}>良かったこと・できたこと</h3>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{log.goodText || '（未入力）'}</p>

                            <h3 className="section-title" style={{ marginTop: '1rem' }}>次に良くしたいこと</h3>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{log.improveText || '（未入力）'}</p>

                            <h3 className="section-title" style={{ marginTop: '1rem' }}>次の練習で意識すること</h3>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{log.tomorrowText || '（未入力）'}</p>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>この日の記録はありません。</p>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
