import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BookOpenText } from 'lucide-react';
import { formatJSTDisplay } from '../lib/date';
import Nav from '../components/Nav';

export default function StoryView() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [, setLocation] = useLocation();

    useEffect(() => {
        const loadStory = async () => {
            try {
                const response = await fetch('/api/story', { credentials: 'include' });
                if (response.status === 401) {
                    setLocation('/login');
                    return;
                }
                if (response.status === 403) {
                    setLocation('/admin/users');
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to load story');
                }
                const json = await response.json();
                
                if (json.story) json.story.createdAt = new Date(json.story.createdAt);
                setData(json);
            } catch (err) {
                setError('物語の読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        loadStory();
    }, [setLocation]);

    if (loading) {
        return <><Nav /><main className="container"><div className="loading-state">読み込み中...</div></main></>;
    }
    if (error || !data) {
        return <><Nav /><main className="container"><div className="alert alert-danger">{error}</div></main></>;
    }

    const { user, story, isReadOnly } = data;

    return (
        <>
            <Nav userName={user.displayName} />
            <main id="main-content" className="container">
                <header className="page-header">
                    <div>
                        <p className="eyebrow">My swim story</p>
                        <h1 className="page-title">私の競泳物語</h1>
                        <p className="muted">水泳を通じて得た経験や学びを、自分の言葉で残します。</p>
                    </div>
                    <div className="button-row">
                        {!isReadOnly && <Link href="/story/edit" className="btn btn-primary">物語を更新</Link>}
                        <Link href="/story/history" className="btn btn-secondary">履歴を見る</Link>
                    </div>
                </header>

                <div className="card">
                    {story ? (
                        <>
                            <div className="story-meta">
                                <span className="badge badge-secondary">Ver.{story.version}</span>
                                <span className="muted">更新日: {formatJSTDisplay(story.createdAt)}</span>
                            </div>
                            <div className="story-content prose">
                                {story.content.split('\n').map((paragraph: string, index: number) => (
                                    <p key={index}>{paragraph || '\u00A0'}</p>
                                ))}
                            </div>
                        </>
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