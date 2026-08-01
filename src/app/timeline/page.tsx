import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDate, formatJSTDateTime, formatJSTDisplay, parseDateOnly } from '@/lib/date';
import Nav from '@/components/Nav';

export const metadata: Metadata = { title: '振り返り' };

const PAGE_SIZE = 30;
const MAX_PAGE_PARAMETER_LENGTH = String(Number.MAX_SAFE_INTEGER).length;

interface TimelineRow {
    recordId: string;
    eventDate: Date;
    logDate: string | null;
    itemType: 'story' | 'daily';
    version: number | null;
    note: string | null;
    score: number | null;
    practiced: boolean | null;
}

interface TimelineItem {
    id: string;
    date: Date;
    dateLabel: string;
    type: 'story' | 'daily';
    title: string;
    description: string;
    href: string;
}

interface TimelinePageProps {
    searchParams: Promise<{ page?: string | string[] }>;
}

function parsePageParameter(value: string | string[] | undefined): number | null {
    if (typeof value !== 'string' || value.length > MAX_PAGE_PARAMETER_LENGTH || !/^[1-9]\d*$/.test(value)) {
        return value === undefined ? 1 : null;
    }

    const page = Number(value);
    return Number.isSafeInteger(page) ? page : null;
}

function pageHref(page: number): string {
    return page <= 1 ? '/timeline' : `/timeline?page=${page}`;
}

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
    const params = await searchParams;
    const requestedPage = parsePageParameter(params.page);
    const user = await requireUser(requestedPage === null ? '/timeline' : pageHref(requestedPage));

    if (requestedPage === null) redirect('/timeline');

    const [storyCount, dailyCount] = await Promise.all([
        prisma.storyVersion.count({ where: { userId: user.id } }),
        prisma.dailyLog.count({ where: { userId: user.id } }),
    ]);
    const totalItems = storyCount + dailyCount;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);

    if (page !== requestedPage) redirect(pageHref(page));

    const offset = (page - 1) * PAGE_SIZE;
    const rows = totalItems === 0 ? [] : await prisma.$queryRaw<TimelineRow[]>`
        SELECT
            "id" AS "recordId",
            "created_at" AS "eventDate",
            NULL::text AS "logDate",
            'story'::text AS "itemType",
            "version",
            "note",
            NULL::integer AS "score",
            NULL::boolean AS "practiced"
        FROM "story_versions"
        WHERE "user_id" = ${user.id}

        UNION ALL

        SELECT
            "id" AS "recordId",
            "log_date"::timestamp AS "eventDate",
            "log_date"::text AS "logDate",
            'daily'::text AS "itemType",
            NULL::integer AS "version",
            NULL::text AS "note",
            "score",
            "practiced"
        FROM "daily_logs"
        WHERE "user_id" = ${user.id}

        ORDER BY "eventDate" DESC, "itemType" DESC, "recordId" DESC
        LIMIT ${PAGE_SIZE}
        OFFSET ${offset}
    `;

    const timeline = rows.map<TimelineItem>((row) => {
        if (row.itemType === 'story') {
            return {
                id: `story-${row.recordId}`,
                date: row.eventDate,
                dateLabel: formatJSTDateTime(row.eventDate),
                type: 'story',
                title: `競泳物語 Ver.${row.version}`,
                description: row.note || '競泳物語を更新しました',
                href: `/story/history/${row.recordId}`,
            };
        }

        const logDate = row.logDate ?? formatJSTDate(row.eventDate);
        const parsedLogDate = parseDateOnly(logDate);
        return {
            id: `daily-${row.recordId}`,
            date: row.eventDate,
            dateLabel: parsedLogDate ? formatJSTDisplay(parsedLogDate) : logDate,
            type: 'daily',
            title: '練習日誌',
            description: `自己評価 ${row.score}/10・練習${row.practiced ? 'あり' : 'なし'}`,
            href: `/daily?date=${encodeURIComponent(logDate)}`,
        };
    });

    const firstItemNumber = totalItems === 0 ? 0 : offset + 1;
    const lastItemNumber = Math.min(offset + timeline.length, totalItems);

    return (
        <>
            <Nav userName={user.displayName} />
            <main id="main-content" className="container">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">Review</p>
                        <h1 className="page-title">振り返り</h1>
                        <p className="muted">日々の練習と、物語の変化を時系列で確認できます。</p>
                    </div>
                </div>

                {timeline.length > 0 ? (
                    <>
                        <p className="muted" aria-live="polite">
                            全{totalItems}件中 {firstItemNumber}〜{lastItemNumber}件を表示
                        </p>
                        <ol className="timeline-list" start={firstItemNumber}>
                            {timeline.map((item) => (
                                <li key={item.id} className="timeline-item">
                                    <time dateTime={item.date.toISOString()} className="muted">{item.dateLabel}</time>
                                    <div>
                                        <p className="timeline-title">
                                            <span className={`badge ${item.type === 'story' ? 'badge-primary' : 'badge-secondary'}`}>
                                                {item.type === 'story' ? '物語' : '日誌'}
                                            </span>{' '}
                                            {item.title}
                                        </p>
                                        <p className="muted" style={{ margin: '0.2rem 0 0' }}>{item.description}</p>
                                    </div>
                                    <Link href={item.href} className="btn btn-secondary" aria-label={`${item.dateLabel}の${item.title}を見る`}>
                                        見る
                                    </Link>
                                </li>
                            ))}
                        </ol>

                        {totalPages > 1 && (
                            <nav aria-label="振り返りのページ" className="button-row" style={{ justifyContent: 'center', marginTop: '1.25rem' }}>
                                {page > 1 && (
                                    <Link href={pageHref(page - 1)} rel="prev" className="btn btn-secondary">
                                        前のページ
                                    </Link>
                                )}
                                <span className="muted" style={{ alignSelf: 'center' }} aria-current="page">
                                    {page} / {totalPages}ページ
                                </span>
                                {page < totalPages && (
                                    <Link href={pageHref(page + 1)} rel="next" className="btn btn-secondary">
                                        次のページ
                                    </Link>
                                )}
                            </nav>
                        )}
                    </>
                ) : (
                    <div className="card empty-state">
                        <p>まだ記録がありません。</p>
                        <div className="button-row" style={{ justifyContent: 'center' }}>
                            <Link href="/daily" className="btn btn-primary">練習日誌を書く</Link>
                            <Link href="/goals" className="btn btn-secondary">大会目標を決める</Link>
                            <Link href="/story/edit" className="btn btn-secondary">競泳物語を書く</Link>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}
