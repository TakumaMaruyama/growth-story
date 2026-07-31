import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDateTime } from '@/lib/date';
import Nav from '@/components/Nav';

export const metadata: Metadata = { title: '競泳物語の履歴' };

const PAGE_SIZE = 50;
const MAX_PAGE_PARAMETER_LENGTH = String(Number.MAX_SAFE_INTEGER).length;

interface Props {
    searchParams: Promise<{ page?: string | string[] }>;
}

function parsePage(value: string | string[] | undefined): number | null {
    if (value === undefined) return 1;
    if (typeof value !== 'string' || value.length > MAX_PAGE_PARAMETER_LENGTH || !/^[1-9]\d*$/.test(value)) {
        return null;
    }
    const page = Number(value);
    return Number.isSafeInteger(page) ? page : null;
}

function historyHref(page: number): string {
    return page <= 1 ? '/story/history' : `/story/history?page=${page}`;
}

export default async function StoryHistoryPage({ searchParams }: Props) {
    const user = await requireUser();
    if (user.role === 'ADMIN') redirect('/admin/users');

    const requestedPage = parsePage((await searchParams).page);
    if (requestedPage === null) redirect('/story/history');

    const totalVersions = await prisma.storyVersion.count({ where: { userId: user.id } });
    const totalPages = Math.max(1, Math.ceil(totalVersions / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    if (page !== requestedPage) redirect(historyHref(page));

    const versions = await prisma.storyVersion.findMany({
        where: { userId: user.id },
        orderBy: { version: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, version: true, createdAt: true, note: true },
    });

    return (
        <>
            <Nav userName={user.displayName} />
            <main id="main-content" className="container">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">History</p>
                        <h1 className="page-title">競泳物語の履歴</h1>
                    </div>
                    <Link href="/story" className="btn btn-secondary">最新版に戻る</Link>
                </div>

                <section className="card" aria-labelledby="history-heading">
                    <h2 id="history-heading" className="section-title">保存したバージョン</h2>
                    {versions.length > 0 ? (
                        <div className="table-wrap">
                            <table className="table">
                                <caption className="visually-hidden">競泳物語の保存履歴</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">バージョン</th>
                                        <th scope="col">保存日時</th>
                                        <th scope="col">メモ</th>
                                        <th scope="col">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {versions.map((version) => (
                                        <tr key={version.id}>
                                            <td>Ver.{version.version}</td>
                                            <td>{formatJSTDateTime(version.createdAt)}</td>
                                            <td>{version.note || <span className="muted">なし</span>}</td>
                                            <td>
                                                <Link
                                                    href={`/story/history/${version.id}`}
                                                    className="btn btn-secondary btn-small"
                                                    aria-label={`競泳物語 Ver.${version.version}を見る`}
                                                >
                                                    見る
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="empty-state">保存履歴はありません。</p>
                    )}

                    {totalPages > 1 && (
                        <nav aria-label="競泳物語の履歴ページ" className="button-row" style={{ justifyContent: 'center', marginTop: '1.25rem' }}>
                            {page > 1 && (
                                <Link href={historyHref(page - 1)} rel="prev" className="btn btn-secondary">
                                    前のページ
                                </Link>
                            )}
                            <span className="muted" style={{ alignSelf: 'center' }} aria-current="page">
                                {page} / {totalPages}ページ
                            </span>
                            {page < totalPages && (
                                <Link href={historyHref(page + 1)} rel="next" className="btn btn-secondary">
                                    次のページ
                                </Link>
                            )}
                        </nav>
                    )}
                </section>
            </main>
        </>
    );
}
