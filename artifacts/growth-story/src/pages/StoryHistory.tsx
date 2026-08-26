import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BookOpenText } from 'lucide-react';
import { formatJSTDisplay } from '../lib/date';
import Nav from '../components/Nav';

export default function StoryHistory() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [, setLocation] = useLocation();

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const response = await fetch('/api/story/history', { credentials: 'include' });
                if (response.status === 401) {
                    setLocation('/login');
                    return;
                }
                if (response.status === 403) {
                    setLocation('/admin/users');
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to load story history');
                }
                const json = await response.json();
                
                // parse dates
                if (json.latestStory) json.latestStory.createdAt = new Date(json.latestStory.createdAt);
                if (json.versions) {
                    json.versions = json.versions.map((v: any) => ({
                        ...v,
                        createdAt: new Date(v.createdAt)
                    }));
                }
                setData(json);
            } catch (err) {
                setError('履歴の読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        loadHistory();
    }, [setLocation]);

    if (loading) {
        return <><Nav /><main className="container"><div className="loading-state">読み込み中...</div></main></>;
    }
    if (error || !data) {
        return <><Nav /><main className="container"><div className="alert alert-danger">{error}</div></main></>;
    }

    const { user, latestStory, versions, isReadOnly } = data;

    return (
        <>
            <Nav userName={user.displayName} />
            <main id="main-content" className="container">
                <header className="page-header">
                    <div>
                        <p className="eyebrow">Version history</p>
                        <h1 className="page-title">これまでの競泳物語</h1>
                        <p className="muted">過去に更新したすべての物語を振り返ることができます。</p>
                    </div>
                    <div className="button-row">
                        <Link href="/story" className="btn btn-secondary">最新版を見る</Link>
                    </div>
                </header>

                <div className="card">
                    {latestStory ? (
                        <div className="table-wrap">
                            <table className="table">
                                <caption className="visually-hidden">競泳物語の更新履歴</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">バージョン</th>
                                        <th scope="col">更新日</th>
                                        <th scope="col">更新メモ</th>
                                        <th scope="col">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {versions.map((version: any) => (
                                        <tr key={version.id}>
                                            <td>
                                                <span className="badge badge-secondary">Ver.{version.version}</span>
                                            </td>
                                            <td>{formatJSTDisplay(version.createdAt)}</td>
                                            <td className="muted">{version.note || '（メモなし）'}</td>
                                            <td>
                                                <Link href={`/story/history/${version.id}`} className="btn btn-secondary btn-small">
                                                    内容を見る
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <BookOpenText aria-hidden="true" size={34} />
                            <p>まだ物語は書かれていません。</p>
                            {!isReadOnly && (
                                <Link href="/story/edit" className="btn btn-primary" style={{ marginTop: '0.6rem' }}>
                                    最初の物語を書く
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}