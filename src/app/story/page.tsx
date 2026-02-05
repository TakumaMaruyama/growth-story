import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { STORY_QUESTIONS } from '@/lib/story-questions';
import { formatJSTDisplay } from '@/lib/date';
import Nav from '@/components/Nav';

export default async function StoryPage() {
    const user = await requireUser();

    if (user.role === 'ADMIN') {
        redirect('/admin/users');
    }

    // Get latest story version with answers
    const latestStory = await prisma.storyVersion.findFirst({
        where: { userId: user.id },
        orderBy: { version: 'desc' },
        include: { answers: true },
    });

    // Create answer map
    const answerMap = new Map<number, string>();
    if (latestStory) {
        for (const answer of latestStory.answers) {
            answerMap.set(answer.questionNo, answer.answerText);
        }
    }

    return (
        <>
            <Nav userName={user.displayName} />
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>私の競泳物語</h1>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link href="/story/edit" className="btn btn-primary">編集する</Link>
                        <Link href="/story/history" className="btn btn-secondary">履歴</Link>
                    </div>
                </div>

                {latestStory ? (
                    <>
                        <div className="alert alert-info">
                            バージョン {latestStory.version} （{formatJSTDisplay(latestStory.createdAt)}）
                            {latestStory.note && <span> - {latestStory.note}</span>}
                        </div>

                        {STORY_QUESTIONS.map((q) => (
                            <div key={q.no} className="card">
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                    Q{q.no}. {q.label}
                                </h3>
                                <p style={{ whiteSpace: 'pre-wrap' }}>
                                    {answerMap.get(q.no) || <span style={{ color: 'var(--secondary)' }}>未回答</span>}
                                </p>
                            </div>
                        ))}
                    </>
                ) : (
                    <div className="card">
                        <p style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                            まだ物語が作成されていません
                        </p>
                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <Link href="/story/edit" className="btn btn-primary">物語を書き始める</Link>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
