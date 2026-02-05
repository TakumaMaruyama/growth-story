import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { STORY_QUESTIONS } from '@/lib/story-questions';
import { formatJSTDisplay } from '@/lib/date';
import Nav from '@/components/Nav';

interface Props {
    params: Promise<{ userId: string; versionId: string }>;
}

export default async function AdminUserStoryVersionPage({ params }: Props) {
    const admin = await requireAdmin();
    const { userId, versionId } = await params;

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!targetUser) {
        notFound();
    }

    const storyVersion = await prisma.storyVersion.findUnique({
        where: { id: versionId },
        include: { answers: true },
    });

    if (!storyVersion || storyVersion.userId !== userId) {
        notFound();
    }

    // Create answer map
    const answerMap = new Map<number, string>();
    for (const answer of storyVersion.answers) {
        answerMap.set(answer.questionNo, answer.answerText);
    }

    return (
        <>
            <Nav userName={admin.displayName} isAdmin />
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>
                        {targetUser.displayName}の物語 Ver.{storyVersion.version}
                    </h1>
                    <Link href={`/admin/users/${userId}/story`} className="btn btn-secondary">履歴に戻る</Link>
                </div>

                <div className="alert alert-info">
                    作成日: {formatJSTDisplay(storyVersion.createdAt)}
                    {storyVersion.note && <span> - {storyVersion.note}</span>}
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
            </div>
        </>
    );
}
