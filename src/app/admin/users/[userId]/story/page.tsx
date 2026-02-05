import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDisplay } from '@/lib/date';
import Nav from '@/components/Nav';

interface Props {
    params: Promise<{ userId: string }>;
}

export default async function AdminUserStoryPage({ params }: Props) {
    const admin = await requireAdmin();
    const { userId } = await params;

    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!targetUser) {
        notFound();
    }

    const versions = await prisma.storyVersion.findMany({
        where: { userId },
        orderBy: { version: 'desc' },
    });

    return (
        <>
            <Nav userName={admin.displayName} isAdmin />
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>{targetUser.displayName}の物語履歴</h1>
                    <Link href={`/admin/users/${userId}`} className="btn btn-secondary">ユーザー詳細に戻る</Link>
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
                                            <Link href={`/admin/users/${userId}/story/${v.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
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
                        <p style={{ textAlign: 'center', color: 'var(--secondary)' }}>物語履歴がありません</p>
                    </div>
                )}
            </div>
        </>
    );
}
