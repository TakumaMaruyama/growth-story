import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { STORY_QUESTIONS } from '@/lib/story-questions';
import { formatJSTDateTime } from '@/lib/date';
import Nav from '@/components/Nav';
import { getUserFullName } from '@/lib/user-name';

interface Props {
    params: Promise<{ userId: string; versionId: string }>;
}

export default async function AdminUserStoryVersionPage({ params }: Props) {
    const { userId, versionId } = await params;
    const admin = await requireAdmin(
        `/admin/users/${encodeURIComponent(userId)}/story/${encodeURIComponent(versionId)}`,
    );

    const [targetUser, storyVersion] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { displayName: true, familyName: true, givenName: true },
        }),
        prisma.storyVersion.findFirst({
            where: { id: versionId, userId },
            include: { answers: { orderBy: { questionNo: 'asc' } } },
        }),
    ]);
    if (!targetUser || !storyVersion) notFound();
    const targetFullName = getUserFullName(targetUser);

    const answerMap = new Map(storyVersion.answers.map((answer) => [answer.questionNo, answer.answerText]));

    return (
        <>
            <Nav userName={admin.displayName} isAdmin />
            <main id="main-content" className="container container-narrow">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">Archived story</p>
                        <h1 className="page-title">{targetFullName}・Ver.{storyVersion.version}</h1>
                    </div>
                    <Link href={`/admin/users/${userId}/story`} className="btn btn-secondary">履歴に戻る</Link>
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
