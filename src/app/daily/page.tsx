'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { BedIcon } from '@phosphor-icons/react/dist/csr/Bed';
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown';
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { FlagIcon } from '@phosphor-icons/react/dist/csr/Flag';
import { FloppyDiskIcon } from '@phosphor-icons/react/dist/csr/FloppyDisk';
import { MedalIcon } from '@phosphor-icons/react/dist/csr/Medal';
import { PersonSimpleSwimIcon } from '@phosphor-icons/react/dist/csr/PersonSimpleSwim';
import { TargetIcon } from '@phosphor-icons/react/dist/csr/Target';
import Nav from '@/components/Nav';
import {
    getDailyLogBadgeProgress,
    isDailyLogBadgeMilestone,
} from '@/lib/daily-log-badges';
import { MAX_DAILY_TEXT_LENGTH } from '@/lib/limits';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { readTabDraft, removeTabDraft, writeTabDraft } from '@/lib/tab-draft-store';
import { loginHref } from '@/lib/return-path';

interface UserInfo {
    id: string;
    displayName: string;
}

interface LogData {
    score: number | null;
    practiced: boolean | null;
    goodText: string;
    improveText: string;
    tomorrowText: string;
}

interface DailyDraft {
    baseRevision: number | null;
    log: LogData;
}

const EMPTY_LOG: LogData = {
    score: null,
    practiced: null,
    goodText: '',
    improveText: '',
    tomorrowText: '',
};

const TODAY_REQUEST_KEY = '__today__';

const PROMPT_DEFINITIONS = [
    {
        key: 'goodText',
        shortLabel: 'できたこと',
        fullLabel: '良かったこと・できたこと',
        placeholder: '例）ターンの姿勢を意識できた。',
        Icon: CheckCircleIcon,
    },
    {
        key: 'improveText',
        shortLabel: '次に変えたい',
        fullLabel: '次に良くしたいこと',
        placeholder: '例）後半も同じリズムで泳ぎたい。',
        Icon: ArrowsClockwiseIcon,
    },
    {
        key: 'tomorrowText',
        shortLabel: '次回の意識',
        fullLabel: '次の練習で意識すること',
        placeholder: '例）ストリームラインを長く保つ。',
        Icon: TargetIcon,
    },
] as const;

type PromptKey = typeof PROMPT_DEFINITIONS[number]['key'];

function logsAreEqual(left: LogData, right: LogData): boolean {
    return left.score === right.score
        && left.practiced === right.practiced
        && left.goodText === right.goodText
        && left.improveText === right.improveText
        && left.tomorrowText === right.tomorrowText;
}

function dailyDraftKey(userId: string, date: string): string {
    return `swim-story:draft:daily:${userId}:${date}`;
}

function isNullableScore(value: unknown): value is number | null {
    return value === null
        || (Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 10);
}

function isNullablePracticed(value: unknown): value is boolean | null {
    return value === null || typeof value === 'boolean';
}

function isLogData(value: unknown): value is LogData {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    return Object.keys(record).every((key) => [
        'score',
        'practiced',
        'goodText',
        'improveText',
        'tomorrowText',
    ].includes(key))
        && isNullableScore(record.score)
        && isNullablePracticed(record.practiced)
        && typeof record.goodText === 'string'
        && typeof record.improveText === 'string'
        && typeof record.tomorrowText === 'string';
}

function isDailyRevision(value: unknown): value is number | null {
    return value === null
        || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1);
}

function isEligibleRecordCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function readDailyDraft(key: string): { draft: DailyDraft | null; available: boolean } {
    try {
        const saved = readTabDraft(key);
        if (!saved.value) return { draft: null, available: saved.durable };
        const value: unknown = JSON.parse(saved.value);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid draft');
        const record = value as Record<string, unknown>;
        if (
            Object.keys(record).some((field) => field !== 'baseRevision' && field !== 'log')
            || !isDailyRevision(record.baseRevision)
            || !isLogData(record.log)
        ) {
            throw new Error('invalid draft');
        }
        return {
            draft: { baseRevision: record.baseRevision, log: record.log },
            available: saved.durable,
        };
    } catch {
        return { draft: null, available: removeDailyDraft(key) };
    }
}

function writeDailyDraft(key: string, draft: DailyDraft): boolean {
    return writeTabDraft(key, JSON.stringify(draft));
}

function removeDailyDraft(key: string): boolean {
    return removeTabDraft(key);
}

function requestKeyToHref(requestKey: string): string {
    return requestKey === TODAY_REQUEST_KEY
        ? '/daily'
        : `/daily?date=${encodeURIComponent(requestKey)}`;
}

function promptIndexForDate(date: string): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return 0;
    const day = Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
    return Math.abs(day) % PROMPT_DEFINITIONS.length;
}

function chooseInitialPrompt(log: LogData, date: string): PromptKey {
    const rotated = PROMPT_DEFINITIONS[promptIndexForDate(date)] ?? PROMPT_DEFINITIONS[0];
    if (log[rotated.key].trim()) return rotated.key;
    return PROMPT_DEFINITIONS.find((prompt) => log[prompt.key].trim())?.key ?? rotated.key;
}

function DailyLogPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedDate = searchParams.get('date') || '';
    const requestKey = requestedDate || TODAY_REQUEST_KEY;

    const [user, setUser] = useState<UserInfo | null>(null);
    const [loadedDate, setLoadedDate] = useState<string | null>(null);
    const [todayDate, setTodayDate] = useState<string | null>(null);
    const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null);
    const [log, setLog] = useState<LogData>(EMPTY_LOG);
    const [activePrompt, setActivePrompt] = useState<PromptKey>('goodText');
    const [detailsExpanded, setDetailsExpanded] = useState(false);
    const [previousFocus, setPreviousFocus] = useState<string | null>(null);
    const [eligibleRecordCount, setEligibleRecordCount] = useState(0);
    const [earnedMilestone, setEarnedMilestone] = useState<number | null>(null);
    const [dirty, setDirty] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draftStorageAvailable, setDraftStorageAvailable] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [conflictMessage, setConflictMessage] = useState('');
    const [loadError, setLoadError] = useState('');
    const [invalidDate, setInvalidDate] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);

    const loadedDateRef = useRef<string | null>(null);
    const loadedRequestKeyRef = useRef<string | null>(null);
    const userIdRef = useRef<string | null>(null);
    const baselineLogRef = useRef<LogData>(EMPTY_LOG);
    const baseRevisionRef = useRef<number | null>(null);
    const dirtyRef = useRef(false);
    const suppressRestoredRequestRef = useRef<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const fetchLog = async () => {
            const previousRequestKey = loadedRequestKeyRef.current;
            if (previousRequestKey && previousRequestKey !== requestKey && dirtyRef.current) {
                const shouldDiscard = window.confirm('保存していない変更があります。破棄して別の日へ移動しますか？');
                if (!shouldDiscard) {
                    suppressRestoredRequestRef.current = previousRequestKey;
                    router.replace(requestKeyToHref(previousRequestKey), { scroll: false });
                    return;
                }
                if (userIdRef.current && loadedDateRef.current) {
                    removeDailyDraft(dailyDraftKey(userIdRef.current, loadedDateRef.current));
                }
            }

            if (suppressRestoredRequestRef.current === requestKey) {
                suppressRestoredRequestRef.current = null;
                return;
            }

            dirtyRef.current = false;
            loadedDateRef.current = null;
            loadedRequestKeyRef.current = null;
            baselineLogRef.current = EMPTY_LOG;
            baseRevisionRef.current = null;
            setDirty(false);
            setLoadedDate(null);
            setLoadedRequestKey(null);
            setTodayDate(null);
            setLog(EMPTY_LOG);
            setDetailsExpanded(false);
            setPreviousFocus(null);
            setEligibleRecordCount(0);
            setEarnedMilestone(null);
            setLoading(true);
            setLoadError('');
            setInvalidDate(false);
            setMessage('');
            setError('');
            setConflictMessage('');

            try {
                const query = requestedDate ? `?date=${encodeURIComponent(requestedDate)}` : '';
                const response = await fetch(`/api/daily${query}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => null) as {
                    error?: string;
                    user?: UserInfo;
                    date?: string;
                    today?: string;
                    previousFocus?: string | null;
                    eligibleRecordCount?: number;
                    log?: (Partial<LogData> & { revision?: number }) | null;
                } | null;

                if (response.status === 401) {
                    router.replace(loginHref(`${window.location.pathname}${window.location.search}`, 'user'));
                    return;
                }
                if (response.status === 403) {
                    router.replace('/admin/users');
                    return;
                }
                if (
                    !response.ok
                    || !data?.user
                    || !data.date
                    || !data.today
                    || !isEligibleRecordCount(data.eligibleRecordCount)
                ) {
                    setInvalidDate(response.status === 400);
                    setLoadError(data?.error ?? '日誌を読み込めませんでした');
                    return;
                }

                const nextLog: LogData = data.log ? {
                    score: data.log.score ?? null,
                    practiced: data.log.practiced ?? null,
                    goodText: data.log.goodText ?? '',
                    improveText: data.log.improveText ?? '',
                    tomorrowText: data.log.tomorrowText ?? '',
                } : EMPTY_LOG;
                const revision = data.log?.revision ?? null;
                if (
                    data.log
                    && (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1)
                ) {
                    setLoadError('受信した日誌の形式が正しくありません');
                    return;
                }
                const savedDraft = readDailyDraft(dailyDraftKey(data.user.id, data.date));
                const draft = savedDraft.draft;
                const initialLog = draft?.log ?? nextLog;
                const hasDraftChanges = !logsAreEqual(initialLog, nextLog);
                const hasStaleDraft = Boolean(
                    draft
                    && hasDraftChanges
                    && draft.baseRevision !== revision,
                );

                setUser(data.user);
                userIdRef.current = data.user.id;
                setDraftStorageAvailable(savedDraft.available);
                setLoadedDate(data.date);
                setTodayDate(data.today);
                setLoadedRequestKey(requestKey);
                setLog(initialLog);
                setActivePrompt(chooseInitialPrompt(initialLog, data.date));
                setPreviousFocus(typeof data.previousFocus === 'string' ? data.previousFocus : null);
                setEligibleRecordCount(data.eligibleRecordCount);
                setDirty(hasDraftChanges);
                loadedDateRef.current = data.date;
                loadedRequestKeyRef.current = requestKey;
                baselineLogRef.current = nextLog;
                baseRevisionRef.current = hasDraftChanges && draft
                    ? draft.baseRevision
                    : revision;
                dirtyRef.current = hasDraftChanges;
                if (hasStaleDraft) {
                    setConflictMessage(
                        '別の画面で保存内容が更新されています。このタブの未保存下書きを復元しました。必要な内容を控えてから、下書きを破棄して最新版を読み込んでください。',
                    );
                }
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
                setLoadError('通信を確認して、もう一度お試しください');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void fetchLog();
        return () => controller.abort();
    }, [reloadToken, requestKey, requestedDate, router]);

    useEffect(() => {
        if (!user || !loadedDate || loading) return;
        const key = dailyDraftKey(user.id, loadedDate);
        const available = dirty
            ? writeDailyDraft(key, { baseRevision: baseRevisionRef.current, log })
            : removeDailyDraft(key);
        const timeout = window.setTimeout(() => setDraftStorageAvailable(available), 0);
        return () => window.clearTimeout(timeout);
    }, [dirty, loadedDate, loading, log, user]);

    const confirmPageExit = useUnsavedChangesWarning(dirty);
    const oversizedFields = PROMPT_DEFINITIONS
        .map((prompt) => ({ label: prompt.fullLabel, value: log[prompt.key] }))
        .filter((field) => field.value.length > MAX_DAILY_TEXT_LENGTH);
    const hasOversizedText = oversizedFields.length > 0;
    const badgeProgress = useMemo(
        () => getDailyLogBadgeProgress(eligibleRecordCount),
        [eligibleRecordCount],
    );
    const activePromptDefinition = PROMPT_DEFINITIONS.find(
        (prompt) => prompt.key === activePrompt,
    ) ?? PROMPT_DEFINITIONS[0];

    const updateLog = <Key extends keyof LogData>(key: Key, value: LogData[Key]) => {
        const next = { ...log, [key]: value };
        const hasChanges = !logsAreEqual(next, baselineLogRef.current);
        dirtyRef.current = hasChanges;
        setDirty(hasChanges);
        setLog(next);
        setMessage('');
        setEarnedMilestone(null);
        if (!conflictMessage) setError('');
    };

    const handleScoreKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, score: number) => {
        let nextScore: number | null = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            nextScore = score === 10 ? 1 : score + 1;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            nextScore = score === 1 ? 10 : score - 1;
        } else if (event.key === 'Home') {
            nextScore = 1;
        } else if (event.key === 'End') {
            nextScore = 10;
        }
        if (nextScore === null) return;

        event.preventDefault();
        updateLog('score', nextScore);
        window.requestAnimationFrame(() => {
            document.querySelector<HTMLInputElement>(`input[name="score"][value="${nextScore}"]`)?.focus();
        });
    };

    const handleDateChange = (nextDate: string) => {
        if (!nextDate || nextDate === loadedDateRef.current || saving) return;
        if (dirtyRef.current && !window.confirm('保存していない変更があります。破棄して別の日へ移動しますか？')) {
            return;
        }
        if (user && loadedDateRef.current) {
            removeDailyDraft(dailyDraftKey(user.id, loadedDateRef.current));
        }

        dirtyRef.current = false;
        loadedDateRef.current = null;
        loadedRequestKeyRef.current = null;
        baselineLogRef.current = EMPTY_LOG;
        baseRevisionRef.current = null;
        setDirty(false);
        setLoadedDate(null);
        setLoadedRequestKey(null);
        setLog(EMPTY_LOG);
        setLoading(true);
        setMessage('');
        setError('');
        setConflictMessage('');
        router.replace(`/daily?date=${encodeURIComponent(nextDate)}`, { scroll: false });
    };

    const handleReloadLatest = () => {
        if (dirtyRef.current && !window.confirm('現在の入力内容を破棄して、最新の日誌を読み込みますか？')) {
            return;
        }
        if (user && loadedDateRef.current) {
            removeDailyDraft(dailyDraftKey(user.id, loadedDateRef.current));
        }

        dirtyRef.current = false;
        baselineLogRef.current = EMPTY_LOG;
        baseRevisionRef.current = null;
        setDirty(false);
        setConflictMessage('');
        setLoading(true);
        setReloadToken((value) => value + 1);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (log.score === null || log.practiced === null) {
            setError('コンディションと練習の記録を選んでください');
            return;
        }
        if (hasOversizedText) {
            setError('文字数を超えている項目を短くしてから保存してください');
            return;
        }

        const saveDate = loadedDateRef.current;
        if (!saveDate || loadedRequestKeyRef.current !== requestKey || loadedRequestKey !== requestKey) {
            setError('日付の読み込みが完了してから保存してください');
            return;
        }

        const savedLog = { ...log };
        const baseRevision = baseRevisionRef.current;
        setSaving(true);
        setMessage('');
        setError('');
        setEarnedMilestone(null);

        try {
            const response = await fetch('/api/daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: saveDate, baseRevision, ...savedLog }),
            });
            const data = await response.json().catch(() => null) as {
                error?: string;
                revision?: number;
                created?: boolean;
                eligibleRecordCount?: number;
            } | null;
            if (!response.ok) {
                if (response.status === 409) {
                    setConflictMessage(data?.error ?? '別の画面で日誌が更新されました。最新の内容を読み込んでください。');
                    return;
                }
                setError(data?.error ?? '保存に失敗しました');
                return;
            }
            if (
                !isDailyRevision(data?.revision)
                || data.revision === null
                || typeof data.created !== 'boolean'
                || !isEligibleRecordCount(data.eligibleRecordCount)
            ) {
                setError('保存結果を確認できませんでした。再読み込みして内容を確認してください');
                return;
            }

            if (loadedDateRef.current === saveDate && loadedRequestKeyRef.current === requestKey) {
                if (user) removeDailyDraft(dailyDraftKey(user.id, saveDate));
                baselineLogRef.current = savedLog;
                baseRevisionRef.current = data.revision;
                dirtyRef.current = false;
                setDirty(false);
                setEligibleRecordCount(data.eligibleRecordCount);
                setMessage('今日の記録を保存しました');
                if (
                    data.created
                    && todayDate !== null
                    && saveDate <= todayDate
                    && isDailyLogBadgeMilestone(data.eligibleRecordCount)
                ) {
                    setEarnedMilestone(data.eligibleRecordCount);
                }
            }
        } catch {
            setError('通信を確認して、もう一度お試しください');
        } finally {
            setSaving(false);
        }
    };

    const canSave = Boolean(
        loadedDate
        && loadedRequestKey === requestKey
        && !loading
        && !loadError
        && !conflictMessage
        && !hasOversizedText
        && log.score !== null
        && log.practiced !== null
        && dirty,
    );
    const badgePercent = Math.round(badgeProgress.progress * 100);

    return (
        <>
            <Nav userName={user?.displayName} beforeLogout={confirmPageExit} />
            <main id="main-content" className="container container-quick-log">
                <div className="quick-log-header">
                    <label className="quick-date-control" htmlFor="date">
                        <CalendarBlankIcon aria-hidden="true" size={24} weight="bold" />
                        <span className="visually-hidden">日付</span>
                        <input
                            type="date"
                            id="date"
                            className="quick-date-input"
                            value={loadedDate ?? ''}
                            onChange={(event) => handleDateChange(event.target.value)}
                            disabled={saving || loading}
                            required
                        />
                    </label>
                    <h1 className="quick-log-title">
                        {loadedDate && loadedDate === todayDate ? '今日の30秒ログ' : 'この日の30秒ログ'}
                    </h1>
                    <p className="quick-log-lead">シンプルに記録して、積み重ねよう。</p>
                </div>

                {loading ? (
                    <div className="card loading-state" role="status">読み込み中…</div>
                ) : loadError ? (
                    <div className="card" role="alert">
                        <p className="error-message">{loadError}</p>
                        <div className="button-row">
                            <button type="button" className="btn btn-secondary" onClick={() => setReloadToken((value) => value + 1)}>
                                再試行
                            </button>
                            {invalidDate && <Link href="/daily" className="btn btn-primary">今日の日誌に戻る</Link>}
                        </div>
                    </div>
                ) : (
                    <>
                        <section className={`milestone-card${earnedMilestone ? ' milestone-card-earned' : ''}`} aria-labelledby="milestone-heading">
                            <div className="milestone-content">
                                <div>
                                    <p className="milestone-kicker">
                                        <FlagIcon aria-hidden="true" size={22} weight="bold" />
                                        {badgeProgress.nextMilestone
                                            ? `次のバッジまであと${badgeProgress.remaining}回`
                                            : 'すべての節目を達成しました'}
                                    </p>
                                    <div
                                        className="milestone-progress-track"
                                        role="progressbar"
                                        aria-label="次の節目までの進み具合"
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={badgePercent}
                                    >
                                        <span className="milestone-progress-value" style={{ width: `${badgePercent}%` }} />
                                    </div>
                                    <p className="milestone-record-count">日誌を残した日 {eligibleRecordCount}日</p>
                                </div>
                                <div className="milestone-preview" aria-label={badgeProgress.nextMilestone ? `${badgeProgress.nextMilestone}回記録バッジ` : '200回記録バッジ'}>
                                    <span className="milestone-icon-stack" aria-hidden="true">
                                        <MedalIcon size={62} weight="duotone" />
                                        <PersonSimpleSwimIcon size={28} weight="bold" />
                                    </span>
                                    <span>
                                        <strong>{badgeProgress.nextMilestone ?? 200}回記録</strong>
                                        <small>節目バッジ</small>
                                    </span>
                                </div>
                            </div>
                            {earnedMilestone && (
                                <p className="milestone-earned-message" role="status">
                                    {earnedMilestone}回記録バッジを獲得しました！
                                </p>
                            )}
                        </section>

                        <form onSubmit={handleSubmit} className="quick-log-form">
                            <section className="quick-step" aria-labelledby="condition-heading">
                                <div className="quick-step-heading">
                                    <h2 id="condition-heading">1. 今日のコンディション</h2>
                                    <span className="required-chip">必須</span>
                                    <p>数字が大きいほど良い状態です</p>
                                </div>
                                <div className="score-options" role="radiogroup" aria-labelledby="condition-heading">
                                    {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                                        <label key={score} className={`score-option${log.score === score ? ' score-option-selected' : ''}`}>
                                            <input
                                                type="radio"
                                                name="score"
                                                value={score}
                                                checked={log.score === score}
                                                onChange={() => updateLog('score', score)}
                                                onKeyDown={(event) => handleScoreKeyDown(event, score)}
                                                disabled={saving}
                                            />
                                            <span>{score}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="score-scale" aria-hidden="true">
                                    <span>とてもきつい</span>
                                    <span>ふつう</span>
                                    <span>とても良い</span>
                                </div>
                            </section>

                            <section className="quick-step" aria-labelledby="practice-heading">
                                <div className="quick-step-heading">
                                    <h2 id="practice-heading">2. 練習の記録</h2>
                                    <span className="required-chip">必須</span>
                                </div>
                                <div className="practice-options" role="radiogroup" aria-labelledby="practice-heading">
                                    <label className={`practice-option${log.practiced === true ? ' practice-option-selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="practiced"
                                            checked={log.practiced === true}
                                            onChange={() => updateLog('practiced', true)}
                                            disabled={saving}
                                        />
                                        <PersonSimpleSwimIcon aria-hidden="true" size={25} weight="bold" />
                                        <span>練習した</span>
                                    </label>
                                    <label className={`practice-option${log.practiced === false ? ' practice-option-selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="practiced"
                                            checked={log.practiced === false}
                                            onChange={() => updateLog('practiced', false)}
                                            disabled={saving}
                                        />
                                        <BedIcon aria-hidden="true" size={25} weight="bold" />
                                        <span>お休み</span>
                                    </label>
                                </div>
                            </section>

                            <section className="quick-step" aria-labelledby="memo-heading">
                                <div className="quick-step-heading quick-step-heading-stacked">
                                    <h2 id="memo-heading">3. ひとことメモ <span>（任意）</span></h2>
                                    <p>今日の練習を振り返って、短く残そう。</p>
                                </div>
                                <div className="prompt-options" aria-label="ひとことメモのテーマ">
                                    {PROMPT_DEFINITIONS.map((prompt) => {
                                        const Icon = prompt.Icon;
                                        const selected = activePrompt === prompt.key;
                                        return (
                                            <button
                                                key={prompt.key}
                                                type="button"
                                                className={`prompt-option${selected ? ' prompt-option-selected' : ''}${log[prompt.key].trim() ? ' prompt-option-complete' : ''}`}
                                                aria-pressed={selected}
                                                onClick={() => setActivePrompt(prompt.key)}
                                                disabled={saving}
                                            >
                                                <Icon aria-hidden="true" size={25} weight={selected ? 'bold' : 'regular'} />
                                                <span>{prompt.shortLabel}</span>
                                                {log[prompt.key].trim() && (
                                                    <CheckCircleIcon
                                                        className="prompt-complete-icon"
                                                        aria-hidden="true"
                                                        size={15}
                                                        weight="fill"
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <label className="visually-hidden" htmlFor={`quick-${activePrompt}`}>
                                    {activePromptDefinition.fullLabel}
                                </label>
                                <textarea
                                    id={`quick-${activePrompt}`}
                                    className="quick-note-input"
                                    value={log[activePrompt]}
                                    onChange={(event) => updateLog(activePrompt, event.target.value)}
                                    placeholder={activePromptDefinition.placeholder}
                                    maxLength={MAX_DAILY_TEXT_LENGTH}
                                    disabled={saving}
                                    aria-invalid={log[activePrompt].length > MAX_DAILY_TEXT_LENGTH}
                                    aria-describedby={`quick-${activePrompt}-count`}
                                />
                                <p id={`quick-${activePrompt}-count`} className="quick-character-count">
                                    {log[activePrompt].length.toLocaleString('ja-JP')} / {MAX_DAILY_TEXT_LENGTH.toLocaleString('ja-JP')}
                                </p>
                                {activePrompt === 'tomorrowText' && previousFocus && !log.tomorrowText.trim() && (
                                    <button
                                        type="button"
                                        className="reuse-focus-button"
                                        onClick={() => updateLog('tomorrowText', previousFocus)}
                                        disabled={saving}
                                    >
                                        <ArrowsClockwiseIcon aria-hidden="true" size={19} weight="bold" />
                                        前回の意識「{previousFocus}」を使う
                                    </button>
                                )}
                            </section>

                            <button
                                type="button"
                                className="detail-toggle"
                                aria-expanded={detailsExpanded}
                                aria-controls="daily-details"
                                onClick={() => setDetailsExpanded((current) => !current)}
                            >
                                <CaretDownIcon aria-hidden="true" size={22} weight="bold" />
                                詳しく振り返る（任意）
                            </button>

                            {detailsExpanded && (
                                <section id="daily-details" className="daily-details" aria-label="詳しい振り返り">
                                    {PROMPT_DEFINITIONS
                                        .filter((prompt) => prompt.key !== activePrompt)
                                        .map((prompt) => (
                                            <div key={prompt.key} className="form-group">
                                                <label htmlFor={`detail-${prompt.key}`} className="form-label">{prompt.fullLabel}</label>
                                                <textarea
                                                    id={`detail-${prompt.key}`}
                                                    className="form-textarea"
                                                    value={log[prompt.key]}
                                                    onChange={(event) => updateLog(prompt.key, event.target.value)}
                                                    placeholder={prompt.placeholder}
                                                    maxLength={MAX_DAILY_TEXT_LENGTH}
                                                    disabled={saving}
                                                    aria-invalid={log[prompt.key].length > MAX_DAILY_TEXT_LENGTH}
                                                    aria-describedby={`detail-${prompt.key}-count`}
                                                />
                                                <p id={`detail-${prompt.key}-count`} className="form-help">
                                                    {log[prompt.key].length.toLocaleString('ja-JP')} / {MAX_DAILY_TEXT_LENGTH.toLocaleString('ja-JP')}文字
                                                </p>
                                                {prompt.key === 'tomorrowText' && previousFocus && !log.tomorrowText.trim() && (
                                                    <button
                                                        type="button"
                                                        className="reuse-focus-button"
                                                        onClick={() => updateLog('tomorrowText', previousFocus)}
                                                        disabled={saving}
                                                    >
                                                        <ArrowsClockwiseIcon aria-hidden="true" size={19} weight="bold" />
                                                        前回の意識「{previousFocus}」を使う
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                </section>
                            )}

                            {hasOversizedText && (
                                <div className="alert alert-warning" role="alert">
                                    旧版で保存された長い内容を読み込んでいます。
                                    {oversizedFields.map((field) => field.label).join('、')}を
                                    {MAX_DAILY_TEXT_LENGTH.toLocaleString('ja-JP')}文字以内に短くすると保存できます。
                                </div>
                            )}

                            {dirty && !draftStorageAvailable && (
                                <p className="alert alert-danger" role="alert">
                                    下書きはこのタブのメモリに一時保護しています。再読み込みやタブを閉じる前に保存してください。
                                </p>
                            )}

                            {conflictMessage && (
                                <div className="alert alert-warning" role="alert">
                                    <p>{conflictMessage}</p>
                                    <button type="button" className="btn btn-secondary" onClick={handleReloadLatest} disabled={saving}>
                                        下書きを破棄して最新版を読み込む
                                    </button>
                                </div>
                            )}

                            <div className="quick-save-area">
                                <div className="quick-save-feedback" aria-live="polite">
                                    {dirty && <span>下書きを自動保存しています</span>}
                                    {!dirty && !message && <span>変更はありません</span>}
                                    {message && <span className="success-message">{message}</span>}
                                    {error && <span className="error-message" role="alert">{error}</span>}
                                </div>
                                <button type="submit" className="btn btn-primary quick-save-button" disabled={saving || !canSave}>
                                    <FloppyDiskIcon aria-hidden="true" size={23} weight="bold" />
                                    {saving ? '保存中…' : '今日の記録を保存'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </main>
        </>
    );
}

export default function DailyLogPage() {
    return (
        <Suspense fallback={(
            <main id="main-content" className="container container-quick-log">
                <div className="card loading-state" role="status">読み込み中…</div>
            </main>
        )}>
            <DailyLogPageContent />
        </Suspense>
    );
}
