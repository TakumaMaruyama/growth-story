'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Nav from '@/components/Nav';
import { MAX_DAILY_TEXT_LENGTH } from '@/lib/limits';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';

interface UserInfo {
    id: string;
    displayName: string;
}

interface LogData {
    score: number;
    practiced: boolean;
    goodText: string;
    improveText: string;
    tomorrowText: string;
}

interface DailyDraft {
    baseRevision: number | null;
    log: LogData;
}

const EMPTY_LOG: LogData = {
    score: 5,
    practiced: false,
    goodText: '',
    improveText: '',
    tomorrowText: '',
};

const TODAY_REQUEST_KEY = '__today__';

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
        && Number.isInteger(record.score)
        && Number(record.score) >= 1
        && Number(record.score) <= 10
        && typeof record.practiced === 'boolean'
        && typeof record.goodText === 'string'
        && typeof record.improveText === 'string'
        && typeof record.tomorrowText === 'string';
}

function isDailyRevision(value: unknown): value is number | null {
    return value === null
        || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1);
}

function readDailyDraft(key: string): { draft: DailyDraft | null; available: boolean } {
    try {
        const raw = window.sessionStorage.getItem(key);
        if (!raw) return { draft: null, available: true };
        const value: unknown = JSON.parse(raw);
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
            available: true,
        };
    } catch {
        return { draft: null, available: removeDailyDraft(key) };
    }
}

function writeDailyDraft(key: string, draft: DailyDraft): boolean {
    try {
        window.sessionStorage.setItem(key, JSON.stringify(draft));
        return true;
    } catch {
        return false;
    }
}

function removeDailyDraft(key: string): boolean {
    try {
        window.sessionStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

function requestKeyToHref(requestKey: string): string {
    return requestKey === TODAY_REQUEST_KEY
        ? '/daily'
        : `/daily?date=${encodeURIComponent(requestKey)}`;
}

function DailyLogPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedDate = searchParams.get('date') || '';
    const requestKey = requestedDate || TODAY_REQUEST_KEY;

    const [user, setUser] = useState<UserInfo | null>(null);
    const [loadedDate, setLoadedDate] = useState<string | null>(null);
    const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null);
    const [log, setLog] = useState<LogData>(EMPTY_LOG);
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
            setLog(EMPTY_LOG);
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
                    log?: (Partial<LogData> & { revision?: number }) | null;
                } | null;

                if (response.status === 401) {
                    router.replace('/login');
                    return;
                }
                if (!response.ok || !data?.user || !data.date) {
                    setInvalidDate(response.status === 400);
                    setLoadError(data?.error ?? '日誌を読み込めませんでした');
                    return;
                }

                const nextLog: LogData = data.log ? {
                    score: data.log.score ?? 5,
                    practiced: data.log.practiced ?? false,
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
                setDraftStorageAvailable(savedDraft.available);
                setLoadedDate(data.date);
                setLoadedRequestKey(requestKey);
                setLog(initialLog);
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
    const oversizedFields = [
        { label: '良かったこと・できたこと', value: log.goodText },
        { label: '次に良くしたいこと', value: log.improveText },
        { label: '次の練習で意識すること', value: log.tomorrowText },
    ].filter((field) => field.value.length > MAX_DAILY_TEXT_LENGTH);
    const hasOversizedText = oversizedFields.length > 0;

    const updateLog = <Key extends keyof LogData>(key: Key, value: LogData[Key]) => {
        const next = { ...log, [key]: value };
        const hasChanges = !logsAreEqual(next, baselineLogRef.current);
        dirtyRef.current = hasChanges;
        setDirty(hasChanges);
        setLog(next);
        setMessage('');
        if (!conflictMessage) setError('');
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

        try {
            const response = await fetch('/api/daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: saveDate, baseRevision, ...savedLog }),
            });
            const data = await response.json().catch(() => null) as { error?: string; revision?: number } | null;
            if (!response.ok) {
                if (response.status === 409) {
                    setConflictMessage(data?.error ?? '別の画面で日誌が更新されました。最新の内容を読み込んでください。');
                    return;
                }
                setError(data?.error ?? '保存に失敗しました');
                return;
            }
            if (!isDailyRevision(data?.revision) || data.revision === null) {
                setError('保存結果を確認できませんでした。再読み込みして内容を確認してください');
                return;
            }

            if (loadedDateRef.current === saveDate && loadedRequestKeyRef.current === requestKey) {
                if (user) removeDailyDraft(dailyDraftKey(user.id, saveDate));
                baselineLogRef.current = savedLog;
                baseRevisionRef.current = data.revision;
                dirtyRef.current = false;
                setDirty(false);
                setMessage('練習日誌を保存しました');
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
        && !hasOversizedText,
    );

    return (
        <>
            <Nav userName={user?.displayName} beforeLogout={confirmPageExit} />
            <main id="main-content" className="container container-narrow">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">Daily journal</p>
                        <h1 className="page-title">練習日誌</h1>
                        <p className="muted">その日の感覚を、短くてもいいので残しておきましょう。</p>
                    </div>
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
                    <form onSubmit={handleSubmit} className="card">
                        <div className="form-group">
                            <label htmlFor="date" className="form-label">日付</label>
                            <input
                                type="date"
                                id="date"
                                className="form-input"
                                value={loadedDate ?? ''}
                                onChange={(event) => handleDateChange(event.target.value)}
                                disabled={saving}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="score" className="form-label">
                                この日の自己評価: <strong>{log.score}/10</strong>
                            </label>
                            <input
                                type="range"
                                id="score"
                                min="1"
                                max="10"
                                value={log.score}
                                onChange={(event) => updateLog('score', Number(event.target.value))}
                                disabled={saving}
                                style={{ width: '100%' }}
                                aria-describedby="score-help"
                            />
                            <p id="score-help" className="score-guide">
                                1〜3: 苦しかった / 4〜6: まずまず / 7〜8: 良かった / 9〜10: 最高だった
                            </p>
                        </div>

                        <div className="form-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={log.practiced}
                                    onChange={(event) => updateLog('practiced', event.target.checked)}
                                    disabled={saving}
                                />
                                この日は練習した
                            </label>
                        </div>

                        <div className="form-group">
                            <label htmlFor="goodText" className="form-label">良かったこと・できたこと</label>
                            <textarea
                                id="goodText"
                                className="form-textarea"
                                value={log.goodText}
                                onChange={(event) => updateLog('goodText', event.target.value)}
                                placeholder="うまくいったこと、頑張れたこと"
                                maxLength={MAX_DAILY_TEXT_LENGTH}
                                disabled={saving}
                                aria-invalid={log.goodText.length > MAX_DAILY_TEXT_LENGTH}
                                aria-describedby="goodText-count"
                            />
                            <p id="goodText-count" className={log.goodText.length > MAX_DAILY_TEXT_LENGTH ? 'error-message' : 'form-help'}>
                                {log.goodText.length.toLocaleString('ja-JP')} / {MAX_DAILY_TEXT_LENGTH.toLocaleString('ja-JP')}文字
                            </p>
                        </div>

                        <div className="form-group">
                            <label htmlFor="improveText" className="form-label">次に良くしたいこと</label>
                            <textarea
                                id="improveText"
                                className="form-textarea"
                                value={log.improveText}
                                onChange={(event) => updateLog('improveText', event.target.value)}
                                placeholder="次はどう変えたいか、何を試したいか"
                                maxLength={MAX_DAILY_TEXT_LENGTH}
                                disabled={saving}
                                aria-invalid={log.improveText.length > MAX_DAILY_TEXT_LENGTH}
                                aria-describedby="improveText-count"
                            />
                            <p id="improveText-count" className={log.improveText.length > MAX_DAILY_TEXT_LENGTH ? 'error-message' : 'form-help'}>
                                {log.improveText.length.toLocaleString('ja-JP')} / {MAX_DAILY_TEXT_LENGTH.toLocaleString('ja-JP')}文字
                            </p>
                        </div>

                        <div className="form-group">
                            <label htmlFor="tomorrowText" className="form-label">次の練習で意識すること</label>
                            <textarea
                                id="tomorrowText"
                                className="form-textarea"
                                value={log.tomorrowText}
                                onChange={(event) => updateLog('tomorrowText', event.target.value)}
                                placeholder="次の練習で一つだけ意識するなら"
                                maxLength={MAX_DAILY_TEXT_LENGTH}
                                disabled={saving}
                                aria-invalid={log.tomorrowText.length > MAX_DAILY_TEXT_LENGTH}
                                aria-describedby="tomorrowText-count"
                            />
                            <p id="tomorrowText-count" className={log.tomorrowText.length > MAX_DAILY_TEXT_LENGTH ? 'error-message' : 'form-help'}>
                                {log.tomorrowText.length.toLocaleString('ja-JP')} / {MAX_DAILY_TEXT_LENGTH.toLocaleString('ja-JP')}文字
                            </p>
                        </div>

                        {hasOversizedText && (
                            <div className="alert alert-warning" role="alert">
                                旧版で保存された長い内容を読み込んでいます。
                                {oversizedFields.map((field) => field.label).join('、')}を
                                {MAX_DAILY_TEXT_LENGTH.toLocaleString('ja-JP')}文字以内に短くすると保存できます。
                            </div>
                        )}

                        {dirty && <p className="alert alert-warning">未保存の変更があります。</p>}

                        {dirty && !draftStorageAvailable && (
                            <p className="alert alert-danger" role="alert">
                                このブラウザでは下書きを自動保存できません。戻る操作やタブを閉じる前に、日誌を保存してください。
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

                        <div aria-live="polite">
                            {message && <p className="success-message">{message}</p>}
                            {error && <p className="error-message" role="alert">{error}</p>}
                        </div>

                        <button type="submit" className="btn btn-primary btn-block" disabled={saving || !canSave}>
                            {saving ? '保存中…' : '練習日誌を保存'}
                        </button>
                    </form>
                )}
            </main>
        </>
    );
}

export default function DailyLogPage() {
    return (
        <Suspense fallback={(
            <main id="main-content" className="container container-narrow">
                <div className="card loading-state" role="status">読み込み中…</div>
            </main>
        )}>
            <DailyLogPageContent />
        </Suspense>
    );
}
