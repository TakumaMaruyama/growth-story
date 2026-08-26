import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BookOpenText } from 'lucide-react';
import Nav from '../components/Nav';
import { loginHref } from '../lib/return-path';
import { formatJSTDisplay } from '../lib/date';

export default function AdminUserStory({ params }: { params: { userId: string } }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [, setLocation] = useLocation();

    useEffect(() => {
        const loadStory = async () => {
            try {
                const response = await fetch(`/api/admin/users/${params.userId}/story`, { credentials: 'include' });
                if (response.status === 401) {
                    setLocation(loginHref('/admin/users', 'admin'));
                    return;
                }
                if (response.status === 403 || response.status === 404) {
                    setLocation('/admin/users');
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to load story versions');
                }
                const json = await response.json();
                
                if (json.versions) {
                    json.versions = json.versions.map((v: any) => ({
                        ...v,
                        createdAt: new Date(v.createdAt)
                    }));
                }
                
                setData(json);
            } catch (err) {
                setError('データの読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        loadStory();
    }, [params.userId, setLocation]);

    if (loading) {
        return <><Nav isAdmin /><main className="container"><div className="loading-state">読み込み中...</div></main></>;
    }
    if (error || !data) {
        return <><Nav isAdmin /><main className="container"><div className="alert alert-danger">{error}</div></main></>;
    }

    const { targetUser, versions } = data;

    return (
        <>
            <Nav isAdmin />
            <main id="main-content" className="container">
                <header className="page-header">
                    <div>
                        <p className="eyebrow">{targetUser.displayName} さんの記録</p>
                        <h1 className="page-title">競泳物語の履歴</h1>
                    </div>
                    <div className="button-row">
                        <Link href={`/admin/users/${targetUser.id}`} className="btn btn-secondary">
                            ユーザー詳細へ戻る
                        </Link>
                    </div>
                </header>

                <div className="card">
                    {versions.length > 0 ? (
                        <div className="table-wrap">
                            <table className="table">
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
                                            <td><span className="badge badge-secondary">Ver.{version.version}</span></td>
                                            <td>{formatJSTDisplay(version.createdAt)}</td>
                                            <td className="muted">{version.note || '（メモなし）'}</td>
                                            <td>
                                                <Link href={`/admin/users/${targetUser.id}/story/${version.id}`} className="btn btn-secondary btn-small">
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
                            <p>物語はまだ書かれていません。</p>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}