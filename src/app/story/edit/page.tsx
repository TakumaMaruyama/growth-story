'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { STORY_QUESTIONS } from '@/lib/story-questions';

interface UserInfo {
    displayName: string;
}

export default function StoryEditPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [currentVersion, setCurrentVersion] = useState<number | null>(null);

    useEffect(() => {
        const fetchStory = async () => {
            try {
                const res = await fetch('/api/story');
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                    if (data.story) {
                        setCurrentVersion(data.story.version);
                        const answerMap: Record<number, string> = {};
                        for (const a of data.story.answers) {
                            answerMap[a.questionNo] = a.answerText;
                        }
                        setAnswers(answerMap);
                    }
                } else if (res.status === 401) {
                    router.push('/login');
                }
            } catch {
                setError('データの取得に失敗しました');
            } finally {
                setLoading(false);
            }
        };
        fetchStory();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const res = await fetch('/api/story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers, note }),
            });

            if (res.ok) {
                router.push('/story');
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
            <div className="container" style={{ maxWidth: '700px' }}>
                <h1 className="page-title">物語を編集</h1>

                {currentVersion !== null && (
                    <div className="alert alert-info">
                        現在のバージョン: {currentVersion}
                        <br />
                        <small>保存すると新しいバージョン（Ver.{currentVersion + 1}）が作成されます</small>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {STORY_QUESTIONS.map((q) => (
                        <div key={q.no} className="form-group">
                            <label htmlFor={`q${q.no}`} className="form-label">
                                Q{q.no}. {q.label}
                            </label>
                            <textarea
                                id={`q${q.no}`}
                                className="form-textarea"
                                value={answers[q.no] || ''}
                                onChange={(e) => setAnswers({ ...answers, [q.no]: e.target.value })}
                                placeholder="自由に書いてください"
                            />
                        </div>
                    ))}

                    <div className="form-group">
                        <label htmlFor="note" className="form-label">
                            今回の保存メモ（任意）
                        </label>
                        <input
                            type="text"
                            id="note"
                            className="form-input"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="例: 夏合宿後に更新"
                        />
                    </div>

                    {error && <p className="error-message">{error}</p>}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        disabled={saving}
                    >
                        {saving ? '保存中...' : '新しいバージョンとして保存'}
                    </button>
                </form>
            </div>
        </>
    );
}
