import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import Nav from '../components/Nav';
import { loginHref } from '../lib/return-path';
import { formatJSTDisplay } from '../lib/date';

export default function AdminUserStoryVersion({ params }: { params: { userId: string, versionId: string } }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [, setLocation] = useLocation();

    useEffect(() => {
        const loadStoryVersion = async () => {
            try {
                const response = await fetch(`/api/admin/users/${params.userId}/story/${params.versionId}`, { credentials: 'include' });
                if (response.status === 401) {
                    setLocation(loginHref('/admin/users', 'admin'));
                    return;
                }
                if (response.status === 403 || response.status === 404) {
                    setLocation('/admin/users');
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to load story version');
                }
                const json = await response.json();
                
                if (json.story) {
                    json.story.createdAt = new Date(json.story.createdAt);
                }
                
                setData(json);
            } catch (err) {
                setError('データの読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        loadStoryVersion();
    }, [params.userId, params.versionId, setLocation]);

    if (loading) {
        return <><Nav isAdmin /><main className="container"><div className="loading-state">読み込み中...</div></main></>;
    }
    if (error || !data) {
        return <><Nav isAdmin /><main className="container"><div className="alert alert-danger">{error}</div></main></>;
    }

    const { targetUser, story } = data;

    return (
        <>
            <Nav isAdmin />
            <main id="main-content" className="container">
                <header className="page-header">
                    <div>
                        <p className="eyebrow">{targetUser.displayName} さんの記録</p>
                        <h1 className="page-title">
                            競泳物語 Ver.{story.version}
                        </h1>
                        <p className="muted">更新日: {formatJSTDisplay(story.createdAt)}</p>
                    </div>
                    <div className="button-row">
                        <Link href={`/admin/users/${targetUser.id}/story`} className="btn btn-secondary">
                            履歴一覧へ戻る
                        </Link>
                    </div>
                </header>

                <div className="card">
                    <div className="story-meta">
                        <span className="badge badge-secondary">Ver.{story.version}</span>
                        {story.note && <span className="muted">更新メモ: {story.note}</span>}
                    </div>
                    <div className="story-content prose">
                        {story.content.split('\n').map((paragraph: string, index: number) => (
                            <p key={index}>{paragraph || '\u00A0'}</p>
                        ))}
                    </div>
                </div>
            </main>
        </>
    );
}