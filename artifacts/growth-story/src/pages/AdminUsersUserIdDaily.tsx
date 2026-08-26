import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Link } from 'wouter';
import Nav from '@/components/Nav';
import { getDailyActivityLabel, type DailyActivityType } from '@/lib/daily-activity';
import { loginHref } from '@/lib/return-path';

interface UserInfo {
    displayName: string;
    fullName?: string;
}

interface DailyLogItem {
    id: string;
    logDate: string;
    score: number;
    activityType: DailyActivityType;
}

export default function AdminUserDailyPage({ params }: { params: { userId: string } }) {
    const { userId } = params;
    const [, setLocation] = useLocation();
    const searchString = useSearch();
    const searchParams = new URLSearchParams(searchString);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';

    const [user, setUser] = useState<UserInfo | null>(null);
    const [logs, setLogs] = useState<DailyLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadLogs = async () => {
            try {
                const q = new URLSearchParams();
                if (from) q.set('from', from);
                if (to) q.set('to', to);
                const queryStr = q.toString() ? `?${q.toString()}` : '';
                
                const res = await fetch(`/api/admin/users/${userId}/daily${queryStr}`, { credentials: 'include' });
                if (res.status === 401) {
                    setLocation(loginHref(`${window.location.pathname}${window.location.search}`, 'admin'));
                    return;
                }
                if (res.status === 403) {
                    setLocation('/admin/users');
                    return;
                }
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                setUser(data.targetUser);
                setLogs(data.logs);
            } catch (err) {
                setError('読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        loadLogs();
    }, [userId, from, to, setLocation]);

    if (loading) return <><Nav isAdmin /><main className="container"><div className="loading-state">読み込み中...</div></main></>;
    if (error || !user) return <><Nav isAdmin /><main className="container"><div className="alert alert-danger">{error}</div></main></>;

    return (
        <>
            <Nav isAdmin />
            <main id="main-content" className="container">
                <header className="page-header">
                    <div>
                        <p className="eyebrow">{user.displayName} さんの記録</p>
                        <h1 className="page-title">練習日誌一覧</h1>
                    </div>
                    <div className="button-row">
                        <Link href={`/admin/users/${userId}`} className="btn btn-secondary">ユーザー詳細へ戻る</Link>
                    </div>
                </header>

                <div className="card">
                    {logs.length > 0 ? (
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th scope="col">日付</th>
                                        <th scope="col">自己評価</th>
                                        <th scope="col">区分</th>
                                        <th scope="col">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id}>
                                            <td>{log.logDate}</td>
                                            <td>{log.score}/10</td>
                                            <td>{getDailyActivityLabel(log.activityType)}</td>
                                            <td>
                                                <Link href={`/admin/users/${userId}/daily/${log.logDate}`} className="btn btn-secondary btn-small">
                                                    内容を見る
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">記録がありません。</div>
                    )}
                </div>
            </main>
        </>
    );
}