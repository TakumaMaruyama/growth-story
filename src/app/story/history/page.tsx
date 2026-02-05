import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDisplay } from '@/lib/date';
import Nav from '@/components/Nav';

export default async function StoryHistoryPage() {
    const user = await requireUser();

    if (user.role === 'ADMIN') {
        redirect('/admin/users');
    }

    const versions = await prisma.storyVersion.findMany({
        where: { userId: user.id },
        orderBy: { version: 'desc' },
    });

    return (
        <>
            <Nav userName={user.displayName} />
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>物語の履歴</h1>
                    <Link href="/story" className="btn btn-secondary">最新版に戻る</Link>
                </div>

                {versions.length > 0 ? (
                    <div className="card">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>バージョン</th>
                                    <th>作成日</th>
                                    <th>メモ</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {versions.map((v) => (
                                    <tr key={v.id}>
                                        <td>Ver.{v.version}</td>
                                        <td>{formatJSTDisplay(v.createdAt)}</td>
                                        <td>{v.note || '-'}</td>
                                        <td>
                                            <Link href={`/story/history/${v.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                                                閲覧
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="card">
                        <p style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                            履歴がありません
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
