import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { formatJSTDisplay } from '../lib/date';
import Nav from '../components/Nav';

export default function StoryHistoryVersion({ params }: { params: { versionId: string } }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [, setLocation] = useLocation();

    useEffect(() => {
        const loadVersion = async () => {
            try {
                const response = await fetch(`/api/story/history/${params.versionId}`, { credentials: 'include' });
                if (response.status === 401) {
                    setLocation('/login');
                    return;
                }
                if (response.status === 403) {
                    setLocation('/admin/users');
                    return;
                }
                if (response.status === 404) {
                    setLocation('/story/history');
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to load story version');
                }
                const json = await response.json();
                
                if (json.story) json.story.createdAt = new Date(json.story.createdAt);
                setData(json);
            } catch (err) {
                setError('履歴の読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        loadVersion();
    }, [params.versionId, setLocation]);

    if (loading) {
        return <><Nav /><main className="container"><div className="loading-state">読み込み中...</div></main></>;
    }
    if (error || !data) {
        return <><Nav /><main className="container"><div className="alert alert-danger">{error}</div></main></>;
    }

    const { user, story } = data;

    return (
        <>
            <Nav userName={user.displayName} />
            <main id="main-content" className="container">
                <header className="page-header">
                    <div>
                        <p className="eyebrow">Archived version</p>
                        <h1 className="page-title">過去の競泳物語</h1>
                        <p className="muted">
                            Ver.{story.version}・{formatJSTDisplay(story.createdAt)} に保存された内容です。
                        </p>
                    </div>
                    <div className="button-row">
                        <Link href="/story/history" className="btn btn-secondary">履歴一覧へ戻る</Link>
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