import { useEffect, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { BookOpenText, Calendar, CalendarDays, ChevronLeft, ChevronRight, List, PenLine, Target } from 'lucide-react';
import { formatJSTDate, formatJSTDateTime, formatJSTDisplay, parseDateOnly, todayJST } from '../lib/date';
import { getDailyActivityLabel } from '../lib/daily-activity';
import { getCompetitionGoalDisplayValues } from '../lib/competition-goal-display';
import {
    formatRecordMonth,
    getRecordCalendarDateRange,
    getRecordCalendarDays,
    groupRecordItemsByDate,
    MAX_RECORD_MONTH,
    MIN_RECORD_MONTH,
    parseRecordSearchParams,
    recordHref,
    shiftRecordMonth,
    type RecordItem,
    type RecordTypeFilter,
} from '../lib/records';
import Nav from '../components/Nav';

const PAGE_SIZE = 30;

const RECORD_TYPE_LABELS = {
    daily: '日誌',
    goal: '大会目標',
    story: '競泳物語',
};

const RECORD_TYPE_SHORT_LABELS = {
    daily: '日',
    goal: '大',
    story: '物',
};

const RECORD_FILTER_LABELS = {
    all: 'すべて',
    daily: '日誌',
    goal: '大会目標',
    story: '競泳物語',
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

function dailyRecordItem(record: any): RecordItem {
    const dateKey = formatJSTDate(new Date(record.logDate));
    return {
        id: `daily-${record.id}`,
        type: 'daily',
        dateKey,
        occurredAt: null,
        sortKey: null,
        dateLabel: parseDateOnly(dateKey) ? formatJSTDisplay(parseDateOnly(dateKey)!) : dateKey,
        typeLabel: RECORD_TYPE_LABELS.daily,
        contextLabel: null,
        statusLabel: null,
        title: '練習日誌',
        description: `自己評価 ${record.score}/10・${getDailyActivityLabel(record.activityType)}`,
        href: `/daily?date=${encodeURIComponent(dateKey)}`,
    };
}

function storyRecordItem(record: any): RecordItem {
    const date = new Date(record.createdAt);
    const dateKey = formatJSTDate(date);
    return {
        id: `story-${record.id}`,
        type: 'story',
        dateKey,
        occurredAt: date.toISOString(),
        sortKey: date.toISOString(),
        dateLabel: formatJSTDateTime(date),
        typeLabel: RECORD_TYPE_LABELS.story,
        contextLabel: null,
        statusLabel: null,
        title: `競泳物語 Ver.${record.version}`,
        description: record.note || '競泳物語を更新しました',
        href: `/story/history/${encodeURIComponent(record.id)}`,
    };
}

function goalRecordItem(record: any): RecordItem {
    const displayGoal = getCompetitionGoalDisplayValues(record);
    const date = record.targetDate ? new Date(record.targetDate) : null;
    const dateKey = date ? formatJSTDate(date) : '';
    const dateLabel = date
        ? record.type === 'ANNUAL'
            ? `${date.getUTCFullYear()}年`
            : `${formatJSTDisplay(date)}${record.type === 'MILESTONE' ? 'まで' : ''}`
        : '未定';
    
    return {
        id: `goal-${record.id}`,
        type: 'goal',
        dateKey,
        occurredAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : null,
        sortKey: dateKey ? null : (record.updatedAt ? new Date(record.updatedAt).toISOString() : null),
        dateLabel,
        typeLabel: RECORD_TYPE_LABELS.goal,
        contextLabel: displayGoal.meetName,
        statusLabel: record.isActive ? null : '削除済み',
        title: displayGoal.goalText || '（目標未設定）',
        description: null,
        href: `/goals?focus=${encodeURIComponent(record.id)}`,
    };
}

function TypeFilters({ state }: { state: any }) {
    const types: RecordTypeFilter[] = ['all', 'daily', 'goal', 'story'];
    return (
        <nav className="record-type-filters" aria-label="記録の種類">
            {types.map((type) => (
                <Link
                    key={type}
                    href={recordHref({ ...state, type, page: 1, month: undefined })}
                    className={`record-filter-link${state.type === type ? ' record-filter-link-active' : ''}`}
                    aria-current={state.type === type ? 'page' : undefined}
                >
                    {RECORD_FILTER_LABELS[type]}
                </Link>
            ))}
        </nav>
    );
}

function EmptyActions({ isReadOnly }: { isReadOnly: boolean }) {
    if (isReadOnly) return null;
    return (
        <div className="record-empty-actions">
            <Link href="/daily" className="btn btn-primary btn-small">
                <PenLine aria-hidden="true" size={16} />
                日誌を書く
            </Link>
            <Link href="/goals?add=1" className="btn btn-secondary btn-small">
                <Target aria-hidden="true" size={16} />
                目標を追加
            </Link>
            <Link href="/story/edit" className="btn btn-secondary btn-small">
                <BookOpenText aria-hidden="true" size={16} />
                物語を更新
            </Link>
        </div>
    );
}

function CalendarView({ state, today, items, undatedGoalCount, isReadOnly }: any) {
    const monthKey = state.month || formatJSTDate(today).slice(0, 7);
    const range = getRecordCalendarDateRange(monthKey);
    if (!range) return null;
    const days = getRecordCalendarDays(monthKey);
    const groups = groupRecordItemsByDate(items);

    const prevMonth = shiftRecordMonth(monthKey, -1);
    const nextMonth = shiftRecordMonth(monthKey, 1);
    const canGoPrev = prevMonth >= MIN_RECORD_MONTH;
    const canGoNext = nextMonth <= MAX_RECORD_MONTH;
    const [, setLocation] = useLocation();

    return (
        <section className="card record-calendar-card" aria-label={`${formatRecordMonth(monthKey)}の記録`}>
            <div className="record-month-toolbar">
                {canGoPrev ? (
                    <Link
                        href={recordHref(state, { month: prevMonth })}
                        className="record-month-button"
                        aria-label="前の月"
                    >
                        <ChevronLeft aria-hidden="true" size={20}  />
                    </Link>
                ) : (
                    <span className="record-month-button record-month-button-disabled">
                        <ChevronLeft aria-hidden="true" size={20}  />
                    </span>
                )}
                <h2>{formatRecordMonth(monthKey)}</h2>
                {canGoNext ? (
                    <Link
                        href={recordHref(state, { month: nextMonth })}
                        className="record-month-button"
                        aria-label="次の月"
                    >
                        <ChevronRight aria-hidden="true" size={20}  />
                    </Link>
                ) : (
                    <span className="record-month-button record-month-button-disabled">
                        <ChevronRight aria-hidden="true" size={20}  />
                    </span>
                )}
                <Link
                    href={recordHref(state, { month: formatJSTDate(today).slice(0, 7) })}
                    className="record-today-link"
                >
                    今月
                </Link>
            </div>
            
            <div className="record-month-picker">
                <label>
                    移動
                    <input
                        type="month"
                        value={monthKey}
                        min={MIN_RECORD_MONTH}
                        max={MAX_RECORD_MONTH}
                        onChange={(e) => {
                            if (e.target.value && e.target.value >= MIN_RECORD_MONTH && e.target.value <= MAX_RECORD_MONTH) {
                                setLocation(recordHref(state, { month: e.target.value }));
                            }
                        }}
                    />
                </label>
            </div>

            <div className="record-calendar-legend">
                <span><span className="record-dot record-dot-daily" />日誌</span>
                <span><span className="record-dot record-dot-goal" />目標</span>
                <span><span className="record-dot record-dot-story" />物語</span>
            </div>

            <div className="record-calendar-wrap">
                <table className="record-calendar">
                    <thead>
                        <tr>
                            {WEEKDAYS.map((w) => <th key={w}>{w}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIndex) => (
                            <tr key={weekIndex}>
                                {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => {
                                    const isOutside = !day.dateKey.startsWith(monthKey);
                                    const dayItems = groups.get(day.dateKey) || [];
                                    const dailyCount = dayItems.filter((i) => i.type === 'daily').length;
                                    const goalCount = dayItems.filter((i) => i.type === 'goal').length;
                                    const storyCount = dayItems.filter((i) => i.type === 'story').length;
                                    
                                    if (dayItems.length === 0) {
                                        return (
                                            <td key={day.dateKey} className={isOutside ? 'record-calendar-outside' : ''}>
                                                <div className="record-calendar-day record-calendar-day-disabled">
                                                    <time dateTime={day.dateKey}>{day.dateKey.split('-')[2].replace(/^0/,'')}</time>
                                                </div>
                                            </td>
                                        );
                                    }

                                    return (
                                        <td key={day.dateKey} className={isOutside ? 'record-calendar-outside' : ''}>
                                            <Link
                                                href={recordHref({ ...state, view: 'list', month: undefined }, { type: 'all', month: day.dateKey.slice(0, 7) }) + `#date-${day.dateKey}`}
                                                className="record-calendar-day"
                                                aria-label={`${day.dateKey}: 記録あり`}
                                            >
                                                <time dateTime={day.dateKey}>{day.dateKey.split('-')[2].replace(/^0/,'')}</time>
                                                <div className="record-calendar-markers" aria-hidden="true">
                                                    {dailyCount > 0 && (
                                                        <span className="record-calendar-marker text-record-daily">
                                                            <span className="record-dot record-dot-daily" />
                                                            {dailyCount > 1 && <b><small>×</small>{dailyCount}</b>}
                                                        </span>
                                                    )}
                                                    {goalCount > 0 && (
                                                        <span className="record-calendar-marker text-record-goal">
                                                            <span className="record-dot record-dot-goal" />
                                                            {goalCount > 1 && <b><small>×</small>{goalCount}</b>}
                                                        </span>
                                                    )}
                                                    {storyCount > 0 && (
                                                        <span className="record-calendar-marker text-record-story">
                                                            <span className="record-dot record-dot-story" />
                                                            {storyCount > 1 && <b><small>×</small>{storyCount}</b>}
                                                        </span>
                                                    )}
                                                </div>
                                            </Link>
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
                    期限未定の目標が{undatedGoalCount}件あります。
                    <Link href="/goals">大会目標を確認する</Link>
                </p>
            )}
        </section>
    );
}

function ListView({ state, items, totalItems, isReadOnly }: any) {
    const groups = Array.from(groupRecordItemsByDate(items).entries());

    return (
        <section aria-label="記録一覧">
            <header className="record-section-heading">
                <h2 className="section-title">記録一覧</h2>
                <span className="record-result-count">全{totalItems.toLocaleString('ja-JP')}件</span>
            </header>
            
            {items.length > 0 ? (
                <>
                    {groups.map(([dateKey, dayItems]) => (
                        <div key={dateKey} id={`date-${dateKey}`} className="record-list-group">
                            {dateKey && <h3>{parseDateOnly(dateKey) ? formatJSTDisplay(parseDateOnly(dateKey)!) : dateKey}</h3>}
                            <ul className="record-list">
                                {dayItems.map((item: any) => (
                                    <li key={item.id}>
                                        <article className={`record-item-card record-item-card-${item.type}`}>
                                            <div className="record-item-main">
                                                <div className="record-item-badges">
                                                    <span className={`record-type-badge record-type-badge-${item.type}`}>
                                                        {RECORD_TYPE_SHORT_LABELS[item.type as keyof typeof RECORD_TYPE_SHORT_LABELS]}
                                                    </span>
                                                    {item.statusLabel && (
                                                        <span className="record-status-badge record-status-badge-archived">{item.statusLabel}</span>
                                                    )}
                                                    <span className="record-item-date">{item.dateLabel}</span>
                                                </div>
                                                {item.contextLabel && (
                                                    <p className="eyebrow" style={{ margin: '0.2rem 0 0.1rem' }}>
                                                        {item.contextLabel}
                                                    </p>
                                                )}
                                                <h3>{item.title}</h3>
                                                {item.description && <p>{item.description}</p>}
                                            </div>
                                            <Link href={item.href} className="btn btn-secondary record-item-action">
                                                詳細
                                            </Link>
                                        </article>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    
                    {totalItems > PAGE_SIZE && (
                        <nav className="record-pagination" aria-label="ページ送り">
                            {state.page > 1 ? (
                                <Link href={recordHref(state, { page: state.page - 1 })} rel="prev" className="btn btn-secondary">
                                    前のページ
                                </Link>
                            ) : <span />}
                            <span className="muted">{state.page} ページ目</span>
                            {state.page * PAGE_SIZE < totalItems ? (
                                <Link href={recordHref(state, { page: state.page + 1 })} rel="next" className="btn btn-secondary">
                                    次のページ
                                </Link>
                            ) : <span />}
                        </nav>
                    )}
                </>
            ) : (
                <div className="card record-empty-state">
                    <List aria-hidden="true" size={34} />
                    <p>{state.type === 'all' ? 'まだ記録がありません。' : `${RECORD_FILTER_LABELS[state.type as keyof typeof RECORD_FILTER_LABELS]}はまだありません。`}</p>
                    <EmptyActions isReadOnly={isReadOnly} />
                </div>
            )}
        </section>
    );
}

export default function Timeline() {
    const searchString = useSearch();
    const searchParams = new URLSearchParams(searchString);
    const today = todayJST();
    
    // Simulate parseRecordSearchParams logic here directly
    const state = {
        view: (searchParams.get('view') === 'list' ? 'list' : 'calendar') as 'list' | 'calendar',
        type: (searchParams.get('type') || 'all') as 'all' | 'daily' | 'goal' | 'story',
        month: searchParams.get('month') || '',
        date: searchParams.get('date') || '',
        page: parseInt(searchParams.get('page') || '1', 10),
    };

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [, setLocation] = useLocation();

    useEffect(() => {
        const loadTimeline = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/timeline?${searchParams.toString()}`, { credentials: 'include' });
                if (response.status === 401) {
                    setLocation('/login');
                    return;
                }
                if (response.status === 403) {
                    setLocation('/admin/users');
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to load timeline');
                }
                const json = await response.json();
                
                // Map the JSON objects via our client side builder functions
                if (json.calendarData) {
                    json.calendarData.items = json.calendarData.items.map((i: any) => {
                        if (i.type === 'daily') return dailyRecordItem(i);
                        if (i.type === 'goal') return goalRecordItem(i);
                        if (i.type === 'story') return storyRecordItem(i);
                        return i;
                    });
                }
                if (json.listPage) {
                    json.listPage.items = json.listPage.items.map((i: any) => {
                        if (i.type === 'daily') return dailyRecordItem(i);
                        if (i.type === 'goal') return goalRecordItem(i);
                        if (i.type === 'story') return storyRecordItem(i);
                        return i;
                    });
                }
                setData(json);
            } catch (err) {
                setError('記録の読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        loadTimeline();
    }, [searchString, setLocation]);

    if (loading) {
        return (
            <>
                <Nav />
                <main className="container"><div className="loading-state">読み込み中...</div></main>
            </>
        );
    }

    if (error || !data) {
        return (
            <>
                <Nav />
                <main className="container"><div className="alert alert-danger">{error}</div></main>
            </>
        );
    }

    const { user, calendarData, listPage, isReadOnly } = data;

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
                            <CalendarDays aria-hidden="true" size={19} />
                            カレンダー
                        </Link>
                        <Link
                            href={recordHref(state, { view: 'list', page: 1 })}
                            className={`record-view-link${state.view === 'list' ? ' record-view-link-active' : ''}`}
                            aria-current={state.view === 'list' ? 'page' : undefined}
                        >
                            <List aria-hidden="true" size={19} />
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