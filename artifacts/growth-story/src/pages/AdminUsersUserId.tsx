import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { formatJSTDisplay, parseDateOnly } from '../lib/date';
import { getDailyActivityLabel } from '../lib/daily-activity';
import Nav from '../components/Nav';
import { loginHref } from '../lib/return-path';

export default function AdminUserDetail({ params }: { params: { userId: string } }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [, setLocation] = useLocation();

    useEffect(() => {
        const loadUser = async () => {
            try {
                const response = await fetch(`/api/admin/users/${params.userId}`, { credentials: 'include' });
                if (response.status === 401) {
                    setLocation(loginHref('/admin/users', 'admin'));
                    return;
                }
                if (response.status === 403 || response.status === 404) {
                    setLocation('/admin/users');
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to load user detail');
                }
                const json = await response.json();
                
                if (json.latestStory) json.latestStory.createdAt = new Date(json.latestStory.createdAt);
                if (json.latestLog) json.latestLog.logDate = new Date(json.latestLog.logDate);
                
                setData(json);
            } catch (err) {
                setError('データの読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        loadUser();
    }, [params.userId, setLocation]);

    if (loading) {
        return <><Nav isAdmin /><main className="container"><div className="loading-state">読み込み中...</div></main></>;
    }
    if (error || !data) {
        return <><Nav isAdmin /><main className="container"><div className="alert alert-danger">{error}</div></main></>;
    }

    const { targetUser, latestStory, latestLog, activeGoalsCount } = data;

    return (
        <>
            <Nav isAdmin />
            <main id="main-content" className="container">
                <header className="page-header">
                    <div>
                        <p className="eyebrow">User Details</p>
                        <h1 className="page-title">{targetUser.displayName} さんの記録</h1>
                        <p className="muted">ログインID: {targetUser.loginId}</p>
                    </div>
                    <div className="button-row">
                        <Link href="/admin/users" className="btn btn-secondary">一覧へ戻る</Link>
                    </div>
                </header>

                <div className="summary-grid">
                    <div className="card">
                        <h2 className="section-title">今日の練習日誌</h2>
                        {latestLog ? (
                            <div className="stack">
                                <p className="muted">最終更新: {formatJSTDisplay(latestLog.logDate)}</p>
                                <p>自己評価 {latestLog.score}/10・{getDailyActivityLabel(latestLog.activityType)}</p>
                                <Link href={`/admin/users/${targetUser.id}/daily`} className="btn btn-secondary btn-small">
                                    日誌を確認する
                                </Link>
                            </div>
                        ) : (
                            <div className="stack">
                                <p className="muted">記録がありません。</p>
                            </div>
                        )}
                    </div>

                    <div className="card">
                        <h2 className="section-title">大会目標</h2>
                        <div className="stack">
                            <p>設定中: {activeGoalsCount}件</p>
                            <Link href={`/admin/users/${targetUser.id}/goals`} className="btn btn-secondary btn-small">
                                目標を確認する
                            </Link>
                        </div>
                    </div>

                    <div className="card">
                        <h2 className="section-title">競泳物語</h2>
                        {latestStory ? (
                            <div className="stack">
                                <p className="muted">最終更新: {formatJSTDisplay(latestStory.createdAt)}</p>
                                <p>最新バージョン: Ver.{latestStory.version}</p>
                                <Link href={`/admin/users/${targetUser.id}/story`} className="btn btn-secondary btn-small">
                                    物語を確認する
                                </Link>
                            </div>
                        ) : (
                            <div className="stack">
                                <p className="muted">記録がありません。</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}