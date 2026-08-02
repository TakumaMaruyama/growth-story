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
import { parseStoryReadResponse, type StoryReadResponse } from '@/lib/story-read-response';
import {
    countAnsweredStoryQuestions,
    resolveInitialStoryQuestionNo,
} from '@/lib/story-question-navigation';
import { readTabDraft, removeTabDraft, writeTabDraft } from '@/lib/tab-draft-store';
import { loginHref } from '@/lib/return-path';
import type { StoryQuestionNo } from '@/lib/story-questions';

interface UserInfo {
    id: string;
    displayName: string;
    membershipStatus: 'ACTIVE' | 'WITHDRAWN';
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
    const saved = readTabDraft(key);
    if (saved.value === null) return { draft: null, available: saved.durable };

    const draft = parseDraft(saved.value);
    if (!draft) removeTabDraft(key);
    return { draft, available: saved.durable };
}

function writeDraft(key: string, draft: StoryDraft): boolean {
    return writeTabDraft(key, JSON.stringify(draft));
}

function removeDraft(key: string): boolean {
    return removeTabDraft(key);
}

export default function StoryEditPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [note, setNote] = useState('');
    const [serverState, setServerState] = useState<StoryFormState>({ answers: {}, note: '' });
    const [currentVersion, setCurrentVersion] = useState<number | null>(null);
    const [legacyAnswerCount, setLegacyAnswerCount] = useState(0);
    const [activeQuestionNo, setActiveQuestionNo] = useState<StoryQuestionNo>(STORY_QUESTIONS[0].no);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draftStorageAvailable, setDraftStorageAvailable] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [versionConflict, setVersionConflict] = useState<VersionConflict | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const draftBaseVersionRef = useRef<number | null>(null);
    const isReadOnly = user?.membershipStatus === 'WITHDRAWN';

    const fingerprint = useMemo(
        () => JSON.stringify({ answers, note }),
        [answers, note],
    );
    const baseline = useMemo(() => JSON.stringify(serverState), [serverState]);
    const hasLocalChanges = !loading && user !== null && fingerprint !== baseline;
    const hasChanges = !isReadOnly && hasLocalChanges;
    const oversizedQuestions = useMemo(
        () => STORY_QUESTIONS
            .filter((question) => (answers[question.no]?.length ?? 0) > MAX_STORY_ANSWER_LENGTH)
            .map((question) => question.no),
        [answers],
    );
    const hasOversizedAnswers = oversizedQuestions.length > 0;
    const hasReachedVersionLimit = currentVersion !== null && currentVersion >= MAX_STORY_VERSIONS;
    const answeredQuestionCount = useMemo(() => countAnsweredStoryQuestions(answers), [answers]);
    const activeQuestionIndex = STORY_QUESTIONS.findIndex((question) => question.no === activeQuestionNo);
    const activeQuestion = STORY_QUESTIONS[activeQuestionIndex] ?? STORY_QUESTIONS[0];
    const confirmPageExit = useUnsavedChangesWarning(hasLocalChanges);

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
                    router.replace(loginHref(`${window.location.pathname}${window.location.search}`, 'user'));
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

                const data: StoryReadResponse | null = parseStoryReadResponse(raw);
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
                const readOnly = data.user.membershipStatus === 'WITHDRAWN';
                const initialState = readOnly ? nextServerState : saved.draft ?? nextServerState;
                const requestedQuestion = new URLSearchParams(window.location.search).get('question');
                const initialQuestionNo = resolveInitialStoryQuestionNo(requestedQuestion, initialState.answers);
                const hasStaleDraft = Boolean(
                    !readOnly
                    && saved.draft
                    && saved.draft.baseVersion !== serverVersion,
                );

                setDraftStorageAvailable(saved.available);
                setUser(data.user);
                setCurrentVersion(serverVersion);
                setLegacyAnswerCount(data.story?.legacyAnswerCount ?? 0);
                setActiveQuestionNo(initialQuestionNo);
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
        if (!user || user.membershipStatus === 'WITHDRAWN' || loading) return;
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

    const selectQuestion = (questionNo: StoryQuestionNo) => {
        setActiveQuestionNo(questionNo);
        router.replace(`/story/edit?question=${questionNo}`, { scroll: false });
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isReadOnly) {
            setSaveError('退会中のため、新規入力や更新はできません。');
            return;
        }
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
                router.replace(loginHref(`${window.location.pathname}${window.location.search}`, 'user'));
                return;
            }
            if (response.status === 403 && apiError.code === 'MEMBERSHIP_WITHDRAWN') {
                setUser((current) => current ? { ...current, membershipStatus: 'WITHDRAWN' } : current);
                setVersionConflict(null);
                setSaveError('退会または保護者同意の撤回により保存できませんでした。現在の入力は未保存です。必要な内容をコピーしてください。');
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
                        {isReadOnly && (
                            <div className="alert alert-warning" role="status">
                                退会中のため、競泳物語は閲覧のみです。利用再開は管理者へご連絡ください。
                            </div>
                        )}
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

                        <section className="card story-question-progress-card" aria-labelledby="story-progress-heading">
                            <div className="story-question-progress-header">
                                <h2 id="story-progress-heading" className="section-title">競泳物語の進み具合</h2>
                                <strong className="story-question-progress-text">
                                    回答済み {answeredQuestionCount}/{STORY_QUESTIONS.length}
                                </strong>
                            </div>
                            <progress
                                className="story-question-progress"
                                value={answeredQuestionCount}
                                max={STORY_QUESTIONS.length}
                                aria-label={`回答済み${answeredQuestionCount}/${STORY_QUESTIONS.length}`}
                            />
                            <div className="form-group story-question-picker">
                                <label htmlFor="story-question-select" className="form-label">質問を選ぶ</label>
                                <select
                                    id="story-question-select"
                                    className="form-input story-question-select"
                                    value={activeQuestion.no}
                                    onChange={(event) => selectQuestion(Number(event.target.value) as StoryQuestionNo)}
                                    disabled={saving}
                                >
                                    {STORY_QUESTIONS.map((question) => (
                                        <option key={question.no} value={question.no}>
                                            Q{question.no}. {question.label}
                                            {answers[question.no]?.trim() ? '（回答済み）' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="story-question-nav" aria-label="質問の移動">
                                <button
                                    type="button"
                                    className="btn btn-secondary story-question-nav-button"
                                    disabled={saving || activeQuestionIndex <= 0}
                                    onClick={() => {
                                        const previousQuestion = STORY_QUESTIONS[activeQuestionIndex - 1];
                                        if (previousQuestion) selectQuestion(previousQuestion.no);
                                    }}
                                >
                                    前へ
                                </button>
                                <span className="story-question-position" aria-live="polite">
                                    Q{activeQuestion.no} / {STORY_QUESTIONS.length}
                                </span>
                                <button
                                    type="button"
                                    className="btn btn-secondary story-question-nav-button"
                                    disabled={saving || activeQuestionIndex >= STORY_QUESTIONS.length - 1}
                                    onClick={() => {
                                        const nextQuestion = STORY_QUESTIONS[activeQuestionIndex + 1];
                                        if (nextQuestion) selectQuestion(nextQuestion.no);
                                    }}
                                >
                                    次へ
                                </button>
                            </div>
                        </section>

                        <section className="card story-question-card" aria-labelledby={`question-${activeQuestion.no}`}>
                            <h2 id={`question-${activeQuestion.no}`} className="question-title">
                                Q{activeQuestion.no}. {activeQuestion.label}
                            </h2>
                            <textarea
                                id={`q${activeQuestion.no}`}
                                className="form-textarea story-question-answer"
                                value={answers[activeQuestion.no] ?? ''}
                                onChange={(event) => {
                                    setAnswers((current) => ({ ...current, [activeQuestion.no]: event.target.value }));
                                    setSaveError('');
                                }}
                                placeholder="自由に書いてください"
                                maxLength={MAX_STORY_ANSWER_LENGTH}
                                disabled={saving}
                                readOnly={isReadOnly}
                                aria-label={`Q${activeQuestion.no}の回答`}
                                aria-invalid={(answers[activeQuestion.no]?.length ?? 0) > MAX_STORY_ANSWER_LENGTH}
                                aria-describedby={`q${activeQuestion.no}-count`}
                            />
                            <p
                                id={`q${activeQuestion.no}-count`}
                                className={(answers[activeQuestion.no]?.length ?? 0) > MAX_STORY_ANSWER_LENGTH ? 'error-message' : 'form-help'}
                            >
                                {(answers[activeQuestion.no] ?? '').length.toLocaleString('ja-JP')} / {MAX_STORY_ANSWER_LENGTH.toLocaleString('ja-JP')}文字
                            </p>
                        </section>

                        {!isReadOnly && <section className="card" aria-labelledby="note-heading">
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
                        </section>}

                        {!isReadOnly && <div className="sticky-actions">
                            <div aria-live="polite">
                                {hasChanges ? (
                                    <span className="muted">
                                        {draftStorageAvailable
                                            ? '下書きはこのタブ内に自動保存されています'
                                            : '下書きはこのタブのメモリに一時保護しています。再読み込みやタブを閉じる前に保存してください'}
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
                        </div>}
                    </form>
                )}
            </main>
        </>
    );
}
