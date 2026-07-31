'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { STORY_QUESTIONS } from '@/lib/story-questions';
import {
    MAX_STORY_ANSWER_LENGTH,
    MAX_STORY_NOTE_LENGTH,
    MAX_STORY_VERSIONS,
} from '@/lib/limits';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';

interface UserInfo {
    id: string;
    displayName: string;
}

interface StoryResponse {
    user: UserInfo;
    story: {
        version: number;
        answers: Array<{ questionNo: number; answerText: string }>;
        legacyAnswerCount: number;
    } | null;
}

interface StoryFormState {
    answers: Record<number, string>;
    note: string;
}

interface StoryDraft extends StoryFormState {
    baseVersion: number | null;
}

interface VersionConflict {
    currentVersion?: number | null;
    restoredDraft?: boolean;
}

const QUESTION_NUMBERS = new Set<number>(STORY_QUESTIONS.map((question) => question.no));

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoryVersion(value: unknown): value is number {
    return typeof value === 'number'
        && Number.isSafeInteger(value)
        && value >= 1;
}

function parseStoryResponse(value: unknown): StoryResponse | null {
    if (!isRecord(value) || !isRecord(value.user)) return null;
    if (
        typeof value.user.id !== 'string'
        || !value.user.id
        || typeof value.user.displayName !== 'string'
        || !value.user.displayName
    ) {
        return null;
    }

    if (value.story === null) {
        return {
            user: { id: value.user.id, displayName: value.user.displayName },
            story: null,
        };
    }
    if (!isRecord(value.story) || !isStoryVersion(value.story.version) || !Array.isArray(value.story.answers)) {
        return null;
    }
    const seenQuestions = new Set<number>();
    const answers: Array<{ questionNo: number; answerText: string }> = [];
    let legacyAnswerCount = 0;
    for (const answer of value.story.answers) {
        if (
            !isRecord(answer)
            || typeof answer.questionNo !== 'number'
            || typeof answer.answerText !== 'string'
        ) {
            return null;
        }
        if (
            !Number.isInteger(answer.questionNo)
            || !QUESTION_NUMBERS.has(answer.questionNo)
            || seenQuestions.has(answer.questionNo)
        ) {
            legacyAnswerCount += 1;
            continue;
        }
        seenQuestions.add(answer.questionNo);
        answers.push({ questionNo: answer.questionNo, answerText: answer.answerText });
    }

    return {
        user: { id: value.user.id, displayName: value.user.displayName },
        story: { version: value.story.version, answers, legacyAnswerCount },
    };
}

function parseApiError(value: unknown): { error?: string; code?: string; currentVersion?: number | null } {
    if (!isRecord(value)) return {};
    return {
        error: typeof value.error === 'string' ? value.error : undefined,
        code: typeof value.code === 'string' ? value.code : undefined,
        currentVersion: value.currentVersion === null || isStoryVersion(value.currentVersion)
            ? value.currentVersion
            : undefined,
    };
}

function draftKey(userId: string) {
    return `swim-story:draft:${userId}`;
}

function parseDraft(value: string): StoryDraft | null {
    try {
        const parsed: unknown = JSON.parse(value);
        if (!isRecord(parsed)) return null;
        if (Object.keys(parsed).some((key) => !['baseVersion', 'answers', 'note'].includes(key))) return null;
        if (
            !(parsed.baseVersion === null || isStoryVersion(parsed.baseVersion))
            || !isRecord(parsed.answers)
            || typeof parsed.note !== 'string'
        ) {
            return null;
        }
        if (parsed.note.length > MAX_STORY_NOTE_LENGTH) return null;

        const entries = Object.entries(parsed.answers);
        if (entries.length > QUESTION_NUMBERS.size) return null;
        const answers: Record<number, string> = {};
        for (const [questionKey, answerText] of entries) {
            const questionNo = Number(questionKey);
            if (
                String(questionNo) !== questionKey
                || !Number.isInteger(questionNo)
                || !QUESTION_NUMBERS.has(questionNo)
                || typeof answerText !== 'string'
            ) {
                return null;
            }
            answers[questionNo] = answerText;
        }

        return { baseVersion: parsed.baseVersion, answers, note: parsed.note };
    } catch {
        return null;
    }
}

function readDraft(key: string): { draft: StoryDraft | null; available: boolean } {
    try {
        const saved = window.sessionStorage.getItem(key);
        if (saved === null) return { draft: null, available: true };

        const draft = parseDraft(saved);
        if (!draft) window.sessionStorage.removeItem(key);
        return { draft, available: true };
    } catch {
        return { draft: null, available: false };
    }
}

function writeDraft(key: string, draft: StoryDraft): boolean {
    try {
        window.sessionStorage.setItem(key, JSON.stringify(draft));
        return true;
    } catch {
        return false;
    }
}

function removeDraft(key: string): boolean {
    try {
        window.sessionStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

export default function StoryEditPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [note, setNote] = useState('');
    const [serverState, setServerState] = useState<StoryFormState>({ answers: {}, note: '' });
    const [currentVersion, setCurrentVersion] = useState<number | null>(null);
    const [legacyAnswerCount, setLegacyAnswerCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draftStorageAvailable, setDraftStorageAvailable] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [versionConflict, setVersionConflict] = useState<VersionConflict | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const draftBaseVersionRef = useRef<number | null>(null);

    const fingerprint = useMemo(
        () => JSON.stringify({ answers, note }),
        [answers, note],
    );
    const baseline = useMemo(() => JSON.stringify(serverState), [serverState]);
    const hasChanges = !loading && user !== null && fingerprint !== baseline;
    const oversizedQuestions = useMemo(
        () => STORY_QUESTIONS
            .filter((question) => (answers[question.no]?.length ?? 0) > MAX_STORY_ANSWER_LENGTH)
            .map((question) => question.no),
        [answers],
    );
    const hasOversizedAnswers = oversizedQuestions.length > 0;
    const hasReachedVersionLimit = currentVersion !== null && currentVersion >= MAX_STORY_VERSIONS;
    const confirmPageExit = useUnsavedChangesWarning(hasChanges);

    useEffect(() => {
        const controller = new AbortController();

        const fetchStory = async () => {
            setLoading(true);
            setLoadError('');
            try {
                const response = await fetch('/api/story', {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const raw: unknown = await response.json().catch(() => null);
                if (response.status === 401) {
                    router.replace('/login');
                    return;
                }
                if (response.status === 403) {
                    router.replace('/admin/users');
                    return;
                }
                if (!response.ok) {
                    setLoadError(parseApiError(raw).error ?? '競泳物語を読み込めませんでした');
                    return;
                }

                const data = parseStoryResponse(raw);
                if (!data) {
                    setLoadError('受信した競泳物語の形式が正しくありません');
                    return;
                }

                const serverAnswers: Record<number, string> = {};
                for (const answer of data.story?.answers ?? []) {
                    serverAnswers[answer.questionNo] = answer.answerText;
                }

                const serverVersion = data.story?.version ?? null;
                const nextServerState = { answers: serverAnswers, note: '' };
                const saved = readDraft(draftKey(data.user.id));
                const initialState = saved.draft ?? nextServerState;
                const hasStaleDraft = Boolean(
                    saved.draft
                    && saved.draft.baseVersion !== serverVersion,
                );

                setDraftStorageAvailable(saved.available);
                setUser(data.user);
                setCurrentVersion(serverVersion);
                setLegacyAnswerCount(data.story?.legacyAnswerCount ?? 0);
                setServerState(nextServerState);
                setAnswers(initialState.answers);
                setNote(initialState.note);
                draftBaseVersionRef.current = saved.draft?.baseVersion ?? serverVersion;
                setSaveError('');
                setVersionConflict(hasStaleDraft
                    ? { currentVersion: serverVersion, restoredDraft: true }
                    : null);
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
                setLoadError('通信を確認して、もう一度お試しください');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void fetchStory();
        return () => controller.abort();
    }, [reloadToken, router]);

    useEffect(() => {
        if (!user || loading) return;
        const key = draftKey(user.id);
        const available = hasChanges
            ? writeDraft(key, { baseVersion: draftBaseVersionRef.current, answers, note })
            : removeDraft(key);
        const timeout = window.setTimeout(() => setDraftStorageAvailable(available), 0);
        return () => window.clearTimeout(timeout);
    }, [answers, currentVersion, hasChanges, loading, note, user]);

    const handleLoadLatest = () => {
        if (hasChanges && !window.confirm('入力中の変更を破棄して、最新の内容を読み込みますか？')) return;
        if (user) removeDraft(draftKey(user.id));
        setLoading(true);
        setSaveError('');
        setVersionConflict(null);
        setReloadToken((value) => value + 1);
    };

    const handleDiscard = () => {
        if (!hasChanges || !window.confirm('入力中の変更をすべて破棄しますか？')) return;
        if (user) removeDraft(draftKey(user.id));

        if (versionConflict) {
            setLoading(true);
            setVersionConflict(null);
            setReloadToken((value) => value + 1);
            return;
        }

        setAnswers({ ...serverState.answers });
        setNote(serverState.note);
        setSaveError('');
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!hasChanges || versionConflict) return;
        if (hasOversizedAnswers) {
            setSaveError('文字数を超えている回答を短くしてから保存してください');
            return;
        }
        const submittedAnswers = { ...answers };
        const submittedNote = note;
        setSaving(true);
        setSaveError('');

        try {
            const response = await fetch('/api/story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseVersion: draftBaseVersionRef.current,
                    answers: submittedAnswers,
                    note: submittedNote,
                }),
            });
            const raw: unknown = await response.json().catch(() => null);
            const apiError = parseApiError(raw);
            if (response.status === 401) {
                router.replace('/login');
                return;
            }
            if (response.status === 403) {
                router.replace('/admin/users');
                return;
            }
            if (response.status === 409 && apiError.code === 'STORY_VERSION_CONFLICT') {
                setVersionConflict({ currentVersion: apiError.currentVersion, restoredDraft: false });
                return;
            }
            if (!response.ok) {
                setSaveError(apiError.error ?? '保存に失敗しました');
                return;
            }

            if (user) removeDraft(draftKey(user.id));
            setServerState({ answers: submittedAnswers, note: submittedNote });
            router.push('/story');
            router.refresh();
        } catch {
            setSaveError('通信を確認して、もう一度お試しください');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Nav userName={user?.displayName} beforeLogout={confirmPageExit} />
            <main id="main-content" className="container container-narrow">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">My story</p>
                        <h1 className="page-title">競泳物語を更新</h1>
                        <p className="muted">今の自分の言葉で書き直すたびに、新しいバージョンとして残ります。</p>
                    </div>
                </div>

                {loading ? (
                    <div className="card loading-state" role="status">読み込み中…</div>
                ) : loadError ? (
                    <div className="card" role="alert">
                        <p className="error-message">{loadError}</p>
                        <button type="button" className="btn btn-secondary" onClick={() => setReloadToken((value) => value + 1)}>
                            再試行
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {currentVersion !== null && (
                            <div className="alert alert-info">
                                現在は Ver.{currentVersion} です。
                                {!hasReachedVersionLimit && <> 保存すると Ver.{currentVersion + 1} が作成されます。</>}
                            </div>
                        )}

                        {hasReachedVersionLimit && (
                            <div className="alert alert-warning" role="alert">
                                保存上限（{MAX_STORY_VERSIONS}件）に達しているため、新しいバージョンは保存できません。
                            </div>
                        )}

                        {legacyAnswerCount > 0 && (
                            <div className="alert alert-warning" role="alert">
                                このバージョンには現在の15問に該当しない旧形式の回答が
                                {legacyAnswerCount}件あります。元の履歴には保持されますが、新しいバージョンには引き継がれません。
                            </div>
                        )}

                        {hasOversizedAnswers && (
                            <div className="alert alert-warning" role="alert">
                                旧版で保存された長い回答を読み込んでいます。
                                Q{oversizedQuestions.join('、Q')}を
                                {MAX_STORY_ANSWER_LENGTH.toLocaleString('ja-JP')}文字以内に短くすると保存できます。
                            </div>
                        )}

                        {versionConflict && (
                            <div className="alert alert-danger" role="alert">
                                <strong>別のタブで競泳物語が更新されました。</strong>
                                <p>
                                    {versionConflict.restoredDraft
                                        ? '保存されていたこのタブの未保存下書きを復元しています。'
                                        : 'この画面の内容は保存されていません。'}
                                    {typeof versionConflict.currentVersion === 'number' && (
                                        <> 最新版は Ver.{versionConflict.currentVersion} です。</>
                                    )}
                                    {versionConflict.currentVersion === null && (
                                        <> サーバー上の保存状態が変わっています。</>
                                    )}
                                    入力内容を必要に応じて控えてから、最新版を読み込んでください。
                                </p>
                                <button type="button" className="btn btn-secondary" onClick={handleLoadLatest}>
                                    入力内容を破棄して最新版を読み込む
                                </button>
                            </div>
                        )}

                        {STORY_QUESTIONS.map((question) => (
                            <section key={question.no} className="card" aria-labelledby={`question-${question.no}`}>
                                <h2 id={`question-${question.no}`} className="question-title">
                                    Q{question.no}. {question.label}
                                </h2>
                                <textarea
                                    id={`q${question.no}`}
                                    className="form-textarea"
                                    value={answers[question.no] ?? ''}
                                    onChange={(event) => {
                                        setAnswers((current) => ({ ...current, [question.no]: event.target.value }));
                                        setSaveError('');
                                    }}
                                    placeholder="自由に書いてください"
                                    maxLength={MAX_STORY_ANSWER_LENGTH}
                                    disabled={saving}
                                    aria-label={`Q${question.no}の回答`}
                                    aria-invalid={(answers[question.no]?.length ?? 0) > MAX_STORY_ANSWER_LENGTH}
                                    aria-describedby={`q${question.no}-count`}
                                />
                                <p
                                    id={`q${question.no}-count`}
                                    className={(answers[question.no]?.length ?? 0) > MAX_STORY_ANSWER_LENGTH ? 'error-message' : 'form-help'}
                                >
                                    {(answers[question.no] ?? '').length.toLocaleString('ja-JP')} / {MAX_STORY_ANSWER_LENGTH.toLocaleString('ja-JP')}文字
                                </p>
                            </section>
                        ))}

                        <section className="card" aria-labelledby="note-heading">
                            <h2 id="note-heading" className="section-title">今回の保存メモ</h2>
                            <label htmlFor="note" className="form-label">変更のきっかけ（任意）</label>
                            <input
                                type="text"
                                id="note"
                                className="form-input"
                                value={note}
                                onChange={(event) => {
                                    setNote(event.target.value);
                                    setSaveError('');
                                }}
                                placeholder="例: 夏合宿を終えて"
                                maxLength={MAX_STORY_NOTE_LENGTH}
                                disabled={saving}
                            />
                            <p className="form-help">{note.length.toLocaleString('ja-JP')} / {MAX_STORY_NOTE_LENGTH.toLocaleString('ja-JP')}文字</p>
                        </section>

                        <div className="sticky-actions">
                            <div aria-live="polite">
                                {hasChanges ? (
                                    <span className="muted">
                                        {draftStorageAvailable
                                            ? '下書きはこのタブ内に自動保存されています'
                                            : '下書きを自動保存できません。戻る操作やタブを閉じる前に保存してください'}
                                    </span>
                                ) : (
                                    <span className="muted">変更はありません</span>
                                )}
                                {saveError && <p className="error-message" role="alert">{saveError}</p>}
                            </div>
                            <div className="button-row">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    disabled={saving || !hasChanges}
                                    onClick={handleDiscard}
                                >
                                    入力中の変更を破棄
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving || !hasChanges || versionConflict !== null || hasReachedVersionLimit || hasOversizedAnswers}
                                >
                                    {saving ? '保存中…' : '更新内容を保存'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </main>
        </>
    );
}
