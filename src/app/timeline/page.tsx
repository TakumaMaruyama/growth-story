import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BookOpenTextIcon } from '@phosphor-icons/react/dist/ssr/BookOpenText';
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/ssr/CalendarBlank';
import { CalendarDotsIcon } from '@phosphor-icons/react/dist/ssr/CalendarDots';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/ssr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight';
import { ListBulletsIcon } from '@phosphor-icons/react/dist/ssr/ListBullets';
import { NotePencilIcon } from '@phosphor-icons/react/dist/ssr/NotePencil';
import { TargetIcon } from '@phosphor-icons/react/dist/ssr/Target';
import { requireUser } from '@/lib/auth';
import { formatJSTDate, formatJSTDateTime, formatJSTDisplay, parseDailyLogDate, parseDateOnly, todayJST } from '@/lib/date';
import { getDailyActivityLabel, type DailyActivityType } from '@/lib/daily-activity';
import { getCompetitionGoalDisplayValues } from '@/lib/competition-goal-display';
import {
    loadRecordCalendarRows,
    loadRecordListPageRows,
    type DailyRecordRow,
    type GoalRecordRow,
    type RecordListRow,
    type StoryRecordRow,
} from '@/lib/record-query';
import {
    formatRecordMonth,
    getJSTDateTimeRange,
    getRecordCalendarDateRange,
    getRecordCalendarDays,
    groupRecordItemsByDate,
    isRecordMonthKey,
    MAX_RECORD_MONTH,
    MIN_RECORD_MONTH,
    parseRecordSearchParams,
    recordHref,
    shiftRecordMonth,
    sortRecordItems,
    type RecordItem,
    type RecordItemType,
    type RecordSearchParams,
    type RecordSearchState,
    type RecordTypeFilter,
} from '@/lib/records';
import Nav from '@/components/Nav';

export const metadata: Metadata = { title: '記録' };

const PAGE_SIZE = 30;

const RECORD_TYPE_LABELS: Record<RecordItemType, string> = {
    daily: '日誌',
    goal: '大会目標',
    story: '競泳物語',
};

const RECORD_TYPE_SHORT_LABELS: Record<RecordItemType, string> = {
    daily: '日',
    goal: '大',
    story: '物',
};

const RECORD_FILTER_LABELS: Record<RecordTypeFilter, string> = {
    all: 'すべて',
    daily: '日誌',
    goal: '大会目標',
    story: '競泳物語',
};

const GOAL_TYPE_LABELS = {
    NEXT_MEET: '大会',
    ANNUAL: '年間',
    MILESTONE: '出場目標',
} as const;

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

interface TimelinePageProps {
    searchParams: Promise<RecordSearchParams>;
}

function displayDate(dateKey: string): string {
    const date = parseDateOnly(dateKey);
    return date ? formatJSTDisplay(date) : dateKey;
}

function dailyRecordItem(record: DailyRecordRow): RecordItem {
    const dateKey = formatJSTDate(record.logDate);
    return {
        id: `daily-${record.id}`,
        type: 'daily',
        dateKey,
        occurredAt: null,
        sortKey: null,
        dateLabel: displayDate(dateKey),
        typeLabel: RECORD_TYPE_LABELS.daily,
        contextLabel: null,
        statusLabel: null,
        title: '練習日誌',
        description: `自己評価 ${record.score}/10・${getDailyActivityLabel(record.activityType)}`,
        href: `/daily?date=${encodeURIComponent(dateKey)}`,
    };
}

function storyRecordItem(record: StoryRecordRow): RecordItem {
    const dateKey = formatJSTDate(record.createdAt);
    return {
        id: `story-${record.id}`,
        type: 'story',
        dateKey,
        occurredAt: record.createdAt.toISOString(),
        sortKey: record.createdAt.toISOString(),
        dateLabel: formatJSTDateTime(record.createdAt),
        typeLabel: RECORD_TYPE_LABELS.story,
        contextLabel: null,
        statusLabel: null,
        title: `競泳物語 Ver.${record.version}`,
        description: record.note || '競泳物語を更新しました',
        href: `/story/history/${encodeURIComponent(record.id)}`,
    };
}

function goalRecordItem(record: GoalRecordRow): RecordItem {
    const displayGoal = getCompetitionGoalDisplayValues(record);
    const dateKey = record.targetDate ? formatJSTDate(record.targetDate) : null;
    const dateLabel = record.type === 'ANNUAL' && record.targetDate
        ? `${record.targetDate.getUTCFullYear()}年`
        : record.targetDate
            ? `${formatJSTDisplay(record.targetDate)}${record.type === 'MILESTONE' ? 'まで' : ''}`
            : '日付未設定';
    const title = displayGoal.meetName || displayGoal.goalText || '大会名未設定';
    const description = displayGoal.meetName && displayGoal.goalText
        ? displayGoal.goalText
        : displayGoal.goalText
            ? '大会名は未設定です'
            : '目標は未設定です';

    return {
        id: `goal-${record.id}`,
        type: 'goal',
        dateKey,
        occurredAt: null,
        sortKey: record.updatedAt.toISOString(),
        dateLabel,
        typeLabel: RECORD_TYPE_LABELS.goal,
        contextLabel: GOAL_TYPE_LABELS[record.type],
        statusLabel: record.isActive ? '設定中' : '過去の目標',
        title,
        description,
        href: `/goals?focus=${encodeURIComponent(record.id)}`,
    };
}

function isDailyActivityType(value: string | null): value is DailyActivityType {
    return value === 'PRACTICE' || value === 'COMPETITION' || value === 'REST';
}

function isGoalRecordType(value: string | null): value is keyof typeof GOAL_TYPE_LABELS {
    return value === 'NEXT_MEET' || value === 'ANNUAL' || value === 'MILESTONE';
}

async function loadCalendarItems(
    userId: string,
    state: RecordSearchState,
): Promise<{ items: RecordItem[]; undatedGoalCount: number }> {
    const range = getRecordCalendarDateRange(state.month);
    const instantRange = getJSTDateTimeRange(range.startKey, range.endKey);
    const { dailyLogs, goals, stories, undatedGoalCount } = await loadRecordCalendarRows(
        userId,
        state.type,
        {
            dateStart: range.start,
            dateEnd: range.end,
            instantStart: instantRange.start,
            instantEnd: instantRange.end,
        },
    );

    return {
        items: sortRecordItems([
            ...dailyLogs.map(dailyRecordItem),
            ...goals.map(goalRecordItem),
            ...stories.map(storyRecordItem),
        ]),
        undatedGoalCount,
    };
}

function listTimelineRowToItem(row: RecordListRow): RecordItem {
    if (row.itemType === 'daily') {
        const logDate = row.dateKey ? parseDateOnly(row.dateKey) : null;
        if (!logDate || row.score === null || !isDailyActivityType(row.activityType)) {
            throw new Error('Invalid daily record row');
        }
        return dailyRecordItem({
            id: row.recordId,
            logDate,
            score: row.score,
            activityType: row.activityType,
        });
    }
    if (row.itemType === 'story') {
        if (row.version === null || !row.sortTime) throw new Error('Invalid story record row');
        return storyRecordItem({
            id: row.recordId,
            version: row.version,
            note: row.note,
            createdAt: row.sortTime,
        });
    }
    if (
        row.itemType !== 'goal'
        || !isGoalRecordType(row.goalType)
        || row.title === null
        || row.isActive === null
        || row.updatedAt === null
    ) {
        throw new Error('Invalid competition goal record row');
    }
    return goalRecordItem({
        id: row.recordId,
        type: row.goalType,
        title: row.title,
        details: row.details,
        targetDate: row.targetDate,
        isActive: row.isActive,
        archivedAt: row.archivedAt,
        updatedAt: row.updatedAt,
    });
}

async function loadListPage(
    userId: string,
    type: RecordTypeFilter,
    page: number,
): Promise<{ items: RecordItem[]; totalItems: number }> {
    const { rows, totalItems } = await loadRecordListPageRows(userId, type, page, PAGE_SIZE);
    return {
        items: rows.map(listTimelineRowToItem),
        totalItems,
    };
}

function TypeFilters({ state }: { state: RecordSearchState }) {
    return (
        <nav className="record-type-filters" aria-label="記録の種類で絞り込み">
            {(Object.keys(RECORD_FILTER_LABELS) as RecordTypeFilter[]).map((type) => (
                <Link
                    key={type}
                    href={recordHref(state, { type, page: 1 })}
                    className={`record-filter-link${state.type === type ? ' record-filter-link-active' : ''}`}
                    aria-current={state.type === type ? 'page' : undefined}
                >
                    {RECORD_FILTER_LABELS[type]}
                </Link>
            ))}
        </nav>
    );
}

function RecordCard({ item }: { item: RecordItem }) {
    return (
        <article className={`record-item-card record-item-card-${item.type}`}>
            <div className="record-item-main">
                <div className="record-item-badges">
                    <span className={`record-type-badge record-type-badge-${item.type}`}>{item.typeLabel}</span>
                    {item.contextLabel && <span className="badge badge-secondary">{item.contextLabel}</span>}
                    {item.statusLabel && (
                        <span className={`record-status-badge${item.statusLabel === '過去の目標' ? ' record-status-badge-archived' : ''}`}>
                            {item.statusLabel}
                        </span>
                    )}
                </div>
                {item.occurredAt || item.dateKey ? (
                    <time dateTime={item.occurredAt ?? item.dateKey ?? undefined} className="record-item-date">{item.dateLabel}</time>
                ) : (
                    <span className="record-item-date">{item.dateLabel}</span>
                )}
                <h3>{item.title}</h3>
                <p>{item.description}</p>
            </div>
            <Link href={item.href} className="btn btn-secondary record-item-action" aria-label={`${item.dateLabel}の${item.title}を開く`}>
                開く
            </Link>
        </article>
    );
}

function RecordList({ items, start = 1 }: { items: RecordItem[]; start?: number }) {
    return (
        <ol className="record-list" start={start} role="list">
            {items.map((item) => (
                <li key={item.id}><RecordCard item={item} /></li>
            ))}
        </ol>
    );
}

function EmptyActions({ isReadOnly, date }: { isReadOnly: boolean; date?: string }) {
    if (isReadOnly) return null;
    const requestedDailyDate = date && parseDailyLogDate(date) ? date : null;
    return (
        <div className="record-empty-actions">
            <Link href={requestedDailyDate ? `/daily?date=${encodeURIComponent(requestedDailyDate)}` : '/daily'} className="btn btn-primary">
                <NotePencilIcon aria-hidden="true" size={19} weight="bold" />
                {date && !requestedDailyDate ? '今日の日誌を書く' : '日誌を書く'}
            </Link>
            <Link href="/goals?add=1" className="btn btn-secondary">
                <TargetIcon aria-hidden="true" size={19} weight="bold" />
                大会目標を追加
            </Link>
            <Link href="/story/edit" className="btn btn-secondary">
                <BookOpenTextIcon aria-hidden="true" size={19} weight="bold" />
                競泳物語を書く
            </Link>
        </div>
    );
}

function CalendarView({
    state,
    today,
    items,
    undatedGoalCount,
    isReadOnly,
}: {
    state: RecordSearchState;
    today: string;
    items: RecordItem[];
    undatedGoalCount: number;
    isReadOnly: boolean;
}) {
    const calendarDays = getRecordCalendarDays(state.month);
    const itemsByDate = groupRecordItemsByDate(items);
    const selectedItems = itemsByDate.get(state.date) ?? [];
    const selectedDateLabel = displayDate(state.date);
    const previousMonth = shiftRecordMonth(state.month, -1);
    const nextMonth = shiftRecordMonth(state.month, 1);
    const currentMonth = today.slice(0, 7);
    const defaultDate = (month: string) => month === currentMonth ? today : `${month}-01`;
    const canGoPrevious = state.month > MIN_RECORD_MONTH;
    const canGoNext = state.month < MAX_RECORD_MONTH;

    return (
        <>
            <section className="card record-calendar-card" aria-labelledby="record-month-heading">
                <div className="record-month-toolbar">
                    {canGoPrevious ? (
                        <Link
                            href={recordHref(state, { month: previousMonth, date: defaultDate(previousMonth), page: 1 })}
                            className="record-month-button"
                            aria-label={`${formatRecordMonth(previousMonth)}を表示`}
                        >
                            <CaretLeftIcon aria-hidden="true" size={20} weight="bold" />
                        </Link>
                    ) : (
                        <span className="record-month-button record-month-button-disabled" aria-disabled="true">
                            <CaretLeftIcon aria-hidden="true" size={20} weight="bold" />
                        </span>
                    )}
                    <h2 id="record-month-heading">{formatRecordMonth(state.month)}</h2>
                    {canGoNext ? (
                        <Link
                            href={recordHref(state, { month: nextMonth, date: defaultDate(nextMonth), page: 1 })}
                            className="record-month-button"
                            aria-label={`${formatRecordMonth(nextMonth)}を表示`}
                        >
                            <CaretRightIcon aria-hidden="true" size={20} weight="bold" />
                        </Link>
                    ) : (
                        <span className="record-month-button record-month-button-disabled" aria-disabled="true">
                            <CaretRightIcon aria-hidden="true" size={20} weight="bold" />
                        </span>
                    )}
                    <Link
                        href={recordHref(state, { month: currentMonth, date: today, page: 1 })}
                        className="record-today-link"
                    >
                        今日
                    </Link>
                </div>

                <form action="/timeline" method="get" className="record-month-picker">
                    <input type="hidden" name="view" value="calendar" />
                    <input type="hidden" name="type" value={state.type} />
                    <label>
                        <span>年月を選ぶ</span>
                        <input
                            type="month"
                            name="month"
                            defaultValue={state.month}
                            min={MIN_RECORD_MONTH}
                            max={MAX_RECORD_MONTH}
                        />
                    </label>
                    <button type="submit" className="btn btn-secondary btn-small">移動</button>
                </form>

                <div className="record-calendar-legend" aria-label="記録の色分け">
                    <span><i className="record-dot record-dot-daily" aria-hidden="true" />日誌</span>
                    <span><i className="record-dot record-dot-goal" aria-hidden="true" />大会目標</span>
                    <span><i className="record-dot record-dot-story" aria-hidden="true" />競泳物語</span>
                </div>

                <a href="#record-day-heading" className="record-calendar-skip">カレンダーを飛ばして選択日の記録へ</a>

                <div className="record-calendar-wrap">
                    <table className="record-calendar">
                        <caption className="visually-hidden">{formatRecordMonth(state.month)}の記録カレンダー</caption>
                        <thead>
                            <tr>
                                {WEEKDAYS.map((weekday) => <th key={weekday} scope="col">{weekday}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: calendarDays.length / 7 }, (_, weekIndex) => (
                                <tr key={calendarDays[weekIndex * 7]?.dateKey}>
                                    {calendarDays.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => {
                                        const dayItems = itemsByDate.get(day.dateKey) ?? [];
                                        const counts = {
                                            daily: dayItems.filter((item) => item.type === 'daily').length,
                                            goal: dayItems.filter((item) => item.type === 'goal').length,
                                            story: dayItems.filter((item) => item.type === 'story').length,
                                        };
                                        const recordSummary = (Object.keys(counts) as RecordItemType[])
                                            .filter((type) => counts[type] > 0)
                                            .map((type) => `${RECORD_TYPE_LABELS[type]}${counts[type]}件`)
                                            .join('、');
                                        const targetMonth = day.dateKey.slice(0, 7);
                                        const canSelectDay = isRecordMonthKey(targetMonth);
                                        const selected = day.dateKey === state.date;
                                        const ariaLabel = `${displayDate(day.dateKey)}${recordSummary ? `、${recordSummary}` : '、記録なし'}${selected ? '、選択中' : ''}`;
                                        const dayContent = (
                                            <>
                                                <time dateTime={day.dateKey}>{day.day}</time>
                                                <span className="record-calendar-markers" aria-hidden="true">
                                                    {(Object.keys(counts) as RecordItemType[]).map((type) => counts[type] > 0 && (
                                                        <span key={type} className={`record-calendar-marker record-calendar-marker-${type}`}>
                                                            <i className={`record-dot record-dot-${type}`} />
                                                            <b>{RECORD_TYPE_SHORT_LABELS[type]}</b>
                                                            <small>{counts[type]}</small>
                                                        </span>
                                                    ))}
                                                </span>
                                            </>
                                        );

                                        return (
                                            <td
                                                key={day.dateKey}
                                                className={`${day.inCurrentMonth ? '' : 'record-calendar-outside '}${selected ? 'record-calendar-selected' : ''}`}
                                            >
                                                {canSelectDay ? (
                                                    <Link
                                                        href={`${recordHref(state, { month: targetMonth, date: day.dateKey, page: 1 })}#record-day-heading`}
                                                        className="record-calendar-day"
                                                        aria-label={ariaLabel}
                                                        aria-current={day.dateKey === today ? 'date' : undefined}
                                                    >
                                                        {dayContent}
                                                    </Link>
                                                ) : (
                                                    <span
                                                        className="record-calendar-day record-calendar-day-disabled"
                                                        aria-label={`${ariaLabel}、表示範囲外`}
                                                    >
                                                        {dayContent}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {undatedGoalCount > 0 && (
                    <p className="record-undated-note">
                        日付未設定の大会目標が{undatedGoalCount}件あります。
                        <Link href={recordHref(state, { view: 'list', type: 'goal', page: 1 })}>一覧で確認</Link>
                    </p>
                )}
            </section>

            <section className="record-day-section" aria-labelledby="record-day-heading">
                <div className="record-section-heading">
                    <div>
                        <p className="eyebrow">Selected day</p>
                        <h2 id="record-day-heading" className="section-title">{selectedDateLabel}の記録</h2>
                    </div>
                    <span className="record-result-count" aria-live="polite">{selectedItems.length}件</span>
                </div>
                {selectedItems.length > 0 ? (
                    <RecordList items={selectedItems} />
                ) : (
                    <div className="card record-empty-state">
                        <CalendarBlankIcon aria-hidden="true" size={34} />
                        <p>この日の{state.type === 'all' ? '記録' : RECORD_FILTER_LABELS[state.type]}はまだありません。</p>
                        <EmptyActions isReadOnly={isReadOnly} date={state.date} />
                    </div>
                )}
            </section>
        </>
    );
}

function ListView({
    state,
    items,
    totalItems,
    isReadOnly,
}: {
    state: RecordSearchState;
    items: RecordItem[];
    totalItems: number;
    isReadOnly: boolean;
}) {
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (state.page > totalPages) redirect(recordHref(state, { page: totalPages }));

    const offset = (state.page - 1) * PAGE_SIZE;
    const undatedItems = items.filter((item) => item.dateKey === null);
    const datedItems = items.filter((item) => item.dateKey !== null);
    const firstItemNumber = totalItems === 0 ? 0 : offset + 1;
    const lastItemNumber = Math.min(offset + items.length, totalItems);

    return (
        <section aria-labelledby="record-list-heading">
            <div className="record-section-heading">
                <div>
                    <p className="eyebrow">All records</p>
                    <h2 id="record-list-heading" className="section-title">記録一覧</h2>
                </div>
                <span className="record-result-count" aria-live="polite">
                    {totalItems === 0 ? '0件' : `${firstItemNumber}〜${lastItemNumber} / ${totalItems}件`}
                </span>
            </div>

            {items.length > 0 ? (
                <>
                    {undatedItems.length > 0 && (
                        <div className="record-list-group">
                            <h3>日付未設定</h3>
                            <RecordList items={undatedItems} start={firstItemNumber} />
                        </div>
                    )}
                    {datedItems.length > 0 && (
                        <div className="record-list-group">
                            {undatedItems.length > 0 && <h3>日付がある記録</h3>}
                            <RecordList items={datedItems} start={firstItemNumber + undatedItems.length} />
                        </div>
                    )}

                    {totalPages > 1 && (
                        <nav aria-label="記録一覧のページ" className="record-pagination">
                            {state.page > 1 ? (
                                <Link href={recordHref(state, { page: state.page - 1 })} rel="prev" className="btn btn-secondary">
                                    前のページ
                                </Link>
                            ) : <span />}
                            <span className="muted" aria-current="page">{state.page} / {totalPages}ページ</span>
                            {state.page < totalPages ? (
                                <Link href={recordHref(state, { page: state.page + 1 })} rel="next" className="btn btn-secondary">
                                    次のページ
                                </Link>
                            ) : <span />}
                        </nav>
                    )}
                </>
            ) : (
                <div className="card record-empty-state">
                    <ListBulletsIcon aria-hidden="true" size={34} />
                    <p>{state.type === 'all' ? 'まだ記録がありません。' : `${RECORD_FILTER_LABELS[state.type]}はまだありません。`}</p>
                    <EmptyActions isReadOnly={isReadOnly} />
                </div>
            )}
        </section>
    );
}

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
    const today = todayJST();
    const state = parseRecordSearchParams(await searchParams, today);
    const user = await requireUser(recordHref(state));
    const isReadOnly = user.membershipStatus === 'WITHDRAWN';
    const calendarData = state.view === 'calendar'
        ? await loadCalendarItems(user.id, state)
        : null;
    const listPage = state.view === 'list'
        ? await loadListPage(user.id, state.type, state.page)
        : null;

    return (
        <>
            <Nav userName={user.displayName} />
            <main id="main-content" className="container record-page">
                <header className="record-page-header">
                    <div>
                        <p className="eyebrow">Your records</p>
                        <h1 className="page-title">記録</h1>
                        <p className="muted">日誌、大会目標、競泳物語を、日付から見つけられます。</p>
                    </div>
                    <nav className="record-view-switch" aria-label="記録の表示形式">
                        <Link
                            href={recordHref(state, { view: 'calendar', page: 1 })}
                            className={`record-view-link${state.view === 'calendar' ? ' record-view-link-active' : ''}`}
                            aria-current={state.view === 'calendar' ? 'page' : undefined}
                        >
                            <CalendarDotsIcon aria-hidden="true" size={19} weight="bold" />
                            カレンダー
                        </Link>
                        <Link
                            href={recordHref(state, { view: 'list', page: 1 })}
                            className={`record-view-link${state.view === 'list' ? ' record-view-link-active' : ''}`}
                            aria-current={state.view === 'list' ? 'page' : undefined}
                        >
                            <ListBulletsIcon aria-hidden="true" size={19} weight="bold" />
                            一覧
                        </Link>
                    </nav>
                </header>

                {isReadOnly && (
                    <div className="alert alert-warning" role="status">
                        退会中のため、過去の記録のみ閲覧できます。利用再開は管理者へご連絡ください。
                    </div>
                )}

                <TypeFilters state={state} />

                {state.view === 'calendar' && calendarData
                    ? (
                        <CalendarView
                            state={state}
                            today={today}
                            items={calendarData.items}
                            undatedGoalCount={calendarData.undatedGoalCount}
                            isReadOnly={isReadOnly}
                        />
                    )
                    : listPage && (
                        <ListView
                            state={state}
                            items={listPage.items}
                            totalItems={listPage.totalItems}
                            isReadOnly={isReadOnly}
                        />
                    )}
            </main>
        </>
    );
}
