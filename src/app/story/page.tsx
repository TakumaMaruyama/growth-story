import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { STORY_QUESTIONS } from '@/lib/story-questions';
import { formatJSTDateTime } from '@/lib/date';
import Nav from '@/components/Nav';

export const metadata: Metadata = { title: '競泳物語' };

export default async function StoryPage() {
    const user = await requireUser();
    if (user.role === 'ADMIN') redirect('/admin/users');

    const latestStory = await prisma.storyVersion.findFirst({
        where: { userId: user.id },
        orderBy: { version: 'desc' },
        include: { answers: { orderBy: { questionNo: 'asc' } } },
    });
    const answerMap = new Map(latestStory?.answers.map((answer) => [answer.questionNo, answer.answerText]));

    return (
        <>
            <Nav userName={user.displayName} />
            <main id="main-content" className="container container-narrow">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">My story</p>
                        <h1 className="page-title">私の競泳物語</h1>
                        <p className="muted">これまでの経験と、これから目指す自分を言葉にした記録です。</p>
                    </div>
                    <div className="button-row">
                        <Link href="/story/edit" className="btn btn-primary">更新する</Link>
                        <Link href="/story/history" className="btn btn-secondary">履歴</Link>
                    </div>
                </div>

                {latestStory ? (
                    <>
                        <div className="alert alert-info">
                            Ver.{latestStory.version}・{formatJSTDateTime(latestStory.createdAt)}
                            {latestStory.note && <span>・{latestStory.note}</span>}
                        </div>

                        {STORY_QUESTIONS.map((question) => (
                            <section key={question.no} className="card" aria-labelledby={`question-${question.no}`}>
                                <h2 id={`question-${question.no}`} className="question-title">
                                    Q{question.no}. {question.label}
                                </h2>
                                <p style={{ whiteSpace: 'pre-wrap' }}>
                                    {answerMap.get(question.no) || <span className="muted">未回答</span>}
                                </p>
                            </section>
                        ))}
                    </>
                ) : (
                    <div className="card empty-state">
                        <p>物語はまだ始まっていません。</p>
                        <Link href="/story/edit" className="btn btn-primary">最初の物語を書く</Link>
                    </div>
                )}
            </main>
        </>
    );
}
