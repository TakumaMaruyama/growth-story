import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { STORY_QUESTIONS } from '@/lib/story-questions';
import { formatJSTDateTime } from '@/lib/date';
import Nav from '@/components/Nav';

interface Props {
    params: Promise<{ versionId: string }>;
}

export default async function StoryVersionPage({ params }: Props) {
    const user = await requireUser();
    if (user.role === 'ADMIN') redirect('/admin/users');
    const { versionId } = await params;

    const storyVersion = await prisma.storyVersion.findFirst({
        where: { id: versionId, userId: user.id },
        include: { answers: { orderBy: { questionNo: 'asc' } } },
    });
    if (!storyVersion) notFound();

    const answerMap = new Map(storyVersion.answers.map((answer) => [answer.questionNo, answer.answerText]));

    return (
        <>
            <Nav userName={user.displayName} />
            <main id="main-content" className="container container-narrow">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">Archived story</p>
                        <h1 className="page-title">競泳物語 Ver.{storyVersion.version}</h1>
                    </div>
                    <Link href="/story/history" className="btn btn-secondary">履歴に戻る</Link>
                </div>

                <div className="alert alert-info">
                    {formatJSTDateTime(storyVersion.createdAt)}
                    {storyVersion.note && <span>・{storyVersion.note}</span>}
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
            </main>
        </>
    );
}
