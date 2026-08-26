import { Calendar, ChevronDown, Save, Archive, Clock, Flag, Plus, Trash } from 'lucide-react';

import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';








import Nav from '@/components/Nav';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import {
    findNextMeetGoalId,
    getCompetitionGoalDisplayValues,
    getCompetitionGoalFieldMapping,
    isCompetitionGoalElapsed,
    sortCompetitionGoalsForDisplay,
} from '@/lib/competition-goal-display';
import {
    MAX_GOAL_DETAILS_LENGTH,
    MAX_GOAL_TITLE_LENGTH,
} from '@/lib/limits';
import { loginHref } from '@/lib/return-path';
import { readTabDraft, removeTabDraft, writeTabDraft } from '@/lib/tab-draft-store';

type GoalType = 'next_meet' | 'annual' | 'milestone';
type GoalFilter = 'all' | GoalType;
type EditableGoalField = 'title' | 'details' | 'targetDate';

interface UserInfo {
    id: string;
    displayName: string;
    membershipStatus: 'ACTIVE' | 'WITHDRAWN';
}

interface GoalApi {
    id: string;
    type: GoalType;
    title: string;
    details: string | null;
    targetDate: string | null;
    isActive: boolean;
    archivedAt: string | null;
    revision: number;
    createdAt: string;
    updatedAt: string;
}

interface GoalForm {
    id: string | null;
    type: GoalType;
    title: string;
    details: string;
    targetDate: string;
    revision: number | null;
}

interface GoalFormState {
    goals: GoalForm[];
    newGoal: GoalForm;
    queuedGoals: GoalForm[];
}

function currentJSTYear(): number {
    return Number(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
    }).format(new Date()));
}

function emptyGoal(type: GoalType): GoalForm {
    return {
        id: null,
        type,
        title: '',
        details: '',
        targetDate: type === 'annual' ? `${currentJSTYear()}-12-31` : '',
        revision: null,
    };
}

function emptyState(): GoalFormState {
    return {
        goals: [],
        newGoal: emptyGoal('next_meet'),
        queuedGoals: [],
    };
}

function goalToForm(goal: GoalApi): GoalForm {
    return {
        id: goal.id,
        type: goal.type,
        title: goal.title,
        details: goal.details ?? '',
        targetDate: goal.targetDate ?? '',
        revision: goal.revision,
    };
}

function isGoalType(value: unknown): value is GoalType {
    return value === 'next_meet' || value === 'annual' || value === 'milestone';
}

function parseGoalApi(value: unknown): GoalApi | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const goal = value as Record<string, unknown>;
    if (
        typeof goal.id !== 'string'
        || !isGoalType(goal.type)
        || typeof goal.title !== 'string'
        || (goal.details !== null && typeof goal.details !== 'string')
        || (goal.targetDate !== null && (
            typeof goal.targetDate !== 'string'
            || !/^\d{4}-\d{2}-\d{2}$/.test(goal.targetDate)
        ))
        || typeof goal.isActive !== 'boolean'
        || (goal.archivedAt !== null && typeof goal.archivedAt !== 'string')
        || !Number.isSafeInteger(goal.revision)
        || Number(goal.revision) < 1
        || typeof goal.createdAt !== 'string'
        || typeof goal.updatedAt !== 'string'
    ) {
        return null;
    }
    return goal as unknown as GoalApi;
}

function parseGoalForm(value: unknown, expectedType: GoalType): GoalForm | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const form = value as Record<string, unknown>;
    if (
        Object.keys(form).some((key) => ![
            'id',
            'type',
            'title',
            'details',
            'targetDate',
            'revision',
        ].includes(key))
        || (form.id !== null && typeof form.id !== 'string')
        || form.type !== expectedType
        || typeof form.title !== 'string'
        || form.title.length > MAX_GOAL_TITLE_LENGTH
        || typeof form.details !== 'string'
        || form.details.length > MAX_GOAL_DETAILS_LENGTH
        || typeof form.targetDate !== 'string'
        || (form.targetDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(form.targetDate))
        || (form.revision !== null && (
            !Number.isSafeInteger(form.revision)
            || Number(form.revision) < 1
        ))
        || (form.id === null) !== (form.revision === null)
    ) {
        return null;
    }
    return form as unknown as GoalForm;
}

function parseGoalDraft(value: string): GoalFormState | null {
    try {
        const draft: unknown = JSON.parse(value);
        if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
        const record = draft as Record<string, unknown>;
        if (Array.isArray(record.goals)) {
            const goals = record.goals.map((goal) => {
                if (!goal || typeof goal !== 'object' || Array.isArray(goal)) return null;
                const type = (goal as Record<string, unknown>).type;
                return isGoalType(type) ? parseGoalForm(goal, type) : null;
            });
            if (goals.some((goal) => goal === null || goal.id === null)) return null;
            if (!record.newGoal || typeof record.newGoal !== 'object') return null;
            const newGoalType = (record.newGoal as Record<string, unknown>).type;
            const newGoal = isGoalType(newGoalType)
                ? parseGoalForm(record.newGoal, newGoalType)
                : null;
            if (!newGoal || newGoal.id !== null) return null;
            const queuedValues = record.queuedGoals === undefined ? [] : record.queuedGoals;
            if (!Array.isArray(queuedValues) || queuedValues.length > 3) return null;
            const queuedGoals = queuedValues.map((goal) => {
                if (!goal || typeof goal !== 'object' || Array.isArray(goal)) return null;
                const type = (goal as Record<string, unknown>).type;
                return isGoalType(type) ? parseGoalForm(goal, type) : null;
            });
            if (queuedGoals.some((goal) => goal === null || goal.id !== null)) return null;
            return {
                goals: goals as GoalForm[],
                newGoal,
                queuedGoals: queuedGoals as GoalForm[],
            };
        }

        if (!Array.isArray(record.milestones)) return null;
        const legacyNextMeet = parseGoalForm(record.nextMeet, 'next_meet');
        const legacyAnnual = parseGoalForm(record.annual, 'annual');
        const legacyNewMilestone = parseGoalForm(record.newMilestone, 'milestone');
        const legacyMilestones = record.milestones.map((goal) => parseGoalForm(goal, 'milestone'));
        if (
            !legacyNextMeet
            || !legacyAnnual
            || !legacyNewMilestone
            || legacyMilestones.some((goal) => goal === null || goal.id === null)
        ) return null;

        const savedGoals = [legacyNextMeet, legacyAnnual, ...legacyMilestones as GoalForm[]]
            .filter((goal): goal is GoalForm & { id: string } => goal.id !== null);
        const unsavedCandidates = [legacyNextMeet, legacyAnnual, legacyNewMilestone]
            .filter((goal) => goal.id === null)
            .filter(goalHasUserInput);

        return {
            goals: sortGoalsByDate(savedGoals),
            newGoal: unsavedCandidates[0] ?? emptyGoal('next_meet'),
            queuedGoals: unsavedCandidates.slice(1),
        };
    } catch {
        return null;
    }
}

function goalStateKey(state: GoalFormState): string {
    return JSON.stringify(state);
}

function goalFormsEqual(left: GoalForm, right: GoalForm): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function goalHasUserInput(goal: GoalForm): boolean {
    return Boolean(
        goal.title.trim()
        || goal.details.trim()
        || (goal.type !== 'annual' && goal.targetDate),
    );
}

function draftKey(userId: string): string {
    return `swim-story:draft:goals:${userId}`;
}

function sortGoalsByDate(goals: GoalForm[]): GoalForm[] {
    return sortCompetitionGoalsForDisplay(goals, currentJSTDate());
}

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
    next_meet: '大会',
    annual: '年間',
    milestone: '出場目標',
};

const GOAL_FILTER_LABELS: Record<GoalFilter, string> = {
    all: 'すべて',
    ...GOAL_TYPE_LABELS,
};

function currentJSTDate(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function formatGoalTarget(goal: { type: GoalType; targetDate: string | null }): string | null {
    if (!goal.targetDate) return null;
    if (goal.type === 'annual') return `${goal.targetDate.slice(0, 4)}年`;
    const formatted = goal.targetDate.replaceAll('-', '.');
    return goal.type === 'milestone' ? `${formatted}まで` : formatted;
}

function mergeGoalDraft(
    server: GoalFormState,
    draft: GoalFormState,
): { state: GoalFormState; skippedStaleDraft: boolean } {
    let skippedStaleDraft = false;

    const draftById = new Map(
        draft.goals
            .filter((goal): goal is GoalForm & { id: string } => goal.id !== null)
            .map((goal) => [goal.id, goal]),
    );
    const goals = server.goals.map((serverGoal) => {
        const draftGoal = serverGoal.id ? draftById.get(serverGoal.id) : undefined;
        if (!draftGoal) return serverGoal;
        draftById.delete(draftGoal.id);
        if (draftGoal.revision === serverGoal.revision) return draftGoal;
        skippedStaleDraft = true;
        return serverGoal;
    });
    if (draftById.size > 0) skippedStaleDraft = true;

    const pendingGoals = [draft.newGoal, ...draft.queuedGoals].filter(goalHasUserInput);
    return {
        state: {
            goals,
            newGoal: pendingGoals[0] ?? emptyGoal('next_meet'),
            queuedGoals: pendingGoals.slice(1),
        },
        skippedStaleDraft,
    };
}

interface GoalFieldsProps {
    form: GoalForm;
    idPrefix: string;
    variant: GoalType;
    disabled: boolean;
    onChange: (field: EditableGoalField, value: string) => void;
}

function GoalFields({ form, idPrefix, variant, disabled, onChange }: GoalFieldsProps) {
    const annualYear = form.targetDate.slice(0, 4);
    const annualYears = Array.from({ length: 16 }, (_, index) => String(currentJSTYear() - 1 + index));
    if (variant === 'annual' && annualYear && !annualYears.includes(annualYear)) {
        annualYears.push(annualYear);
        annualYears.sort();
    }
    const labels = variant === 'next_meet'
        ? {
            meetName: '大会名・種目など（任意）',
            meetNamePlaceholder: '例）秋季記録会・100m自由形',
            date: '大会日（任意）',
            goal: 'この大会での目標',
            goalPlaceholder: '例）100m自由形で59秒台を出す',
        }
        : variant === 'annual'
            ? {
                meetName: '大会名（任意）',
                meetNamePlaceholder: '例）日本マスターズ水泳選手権',
                date: '対象年',
                goal: '年間の大会目標',
                goalPlaceholder: '例）全国大会で決勝に残る',
            }
            : {
                meetName: '大会名',
                meetNamePlaceholder: '例）日本選手権',
                date: 'いつまでに',
                goal: 'この大会に出るための目標（任意）',
                goalPlaceholder: '例）100m自由形の標準記録を突破する',
            };
    const { meetNameField, goalTextField } = getCompetitionGoalFieldMapping(variant);
    const meetName = form[meetNameField];
    const goalText = form[goalTextField];
    const meetNameLimit = meetNameField === 'title'
        ? MAX_GOAL_TITLE_LENGTH
        : MAX_GOAL_DETAILS_LENGTH;
    const goalTextLimit = goalTextField === 'title'
        ? MAX_GOAL_TITLE_LENGTH
        : MAX_GOAL_DETAILS_LENGTH;
    const meetNameRequired = meetNameField === 'title';
    const goalTextRequired = goalTextField === 'title';

    return (
        <div className="goal-fields">
            <div className="form-group">
                <label className="form-label" htmlFor={`${idPrefix}-meet-name`}>
                    {labels.meetName}
                    {meetNameRequired && <span className="required-chip">必須</span>}
                </label>
                <input
                    id={`${idPrefix}-meet-name`}
                    className="form-input goal-title-input"
                    value={meetName}
                    onChange={(event) => onChange(meetNameField, event.target.value)}
                    placeholder={labels.meetNamePlaceholder}
                    maxLength={meetNameLimit}
                    disabled={disabled}
                    required={meetNameRequired}
                />
                <p className="form-help goal-character-count">
                    {meetName.length}/{meetNameLimit.toLocaleString('ja-JP')}文字
                </p>
            </div>

            <div className="form-group goal-date-field">
                <label className="form-label" htmlFor={`${idPrefix}-date`}>
                    <Calendar aria-hidden="true" size={18}  />
                    {labels.date}
                    {(variant === 'annual' || variant === 'milestone') && <span className="required-chip">必須</span>}
                </label>
                {variant === 'annual' ? (
                    <select
                        id={`${idPrefix}-date`}
                        className="form-input"
                        value={annualYear}
                        onChange={(event) => onChange(
                            'targetDate',
                            event.target.value ? `${event.target.value}-12-31` : '',
                        )}
                        disabled={disabled}
                        required
                    >
                        <option value="">年を選択</option>
                        {annualYears.map((year) => (
                            <option key={year} value={year}>{year}年</option>
                        ))}
                    </select>
                ) : (
                    <input
                        id={`${idPrefix}-date`}
                        type="date"
                        className="form-input"
                        value={form.targetDate}
                        onChange={(event) => onChange('targetDate', event.target.value)}
                        min="1970-01-01"
                        max="2100-12-31"
                        disabled={disabled}
                        required={variant === 'milestone'}
                    />
                )}
            </div>

            <div className="form-group goal-details-field">
                <label className="form-label" htmlFor={`${idPrefix}-goal`}>
                    {labels.goal}
                    {goalTextRequired && <span className="required-chip">必須</span>}
                </label>
                <textarea
                    id={`${idPrefix}-goal`}
                    className="form-textarea goal-details-input"
                    value={goalText}
                    onChange={(event) => onChange(goalTextField, event.target.value)}
                    placeholder={labels.goalPlaceholder}
                    maxLength={goalTextLimit}
                    disabled={disabled}
                    required={goalTextRequired}
                />
                <p className="form-help goal-character-count">
                    {goalText.length}/{goalTextLimit.toLocaleString('ja-JP')}文字
                </p>
            </div>
        </div>
    );
}

export default function GoalsPage() {
    const [, setLocation] = useLocation();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [forms, setForms] = useState<GoalFormState>(emptyState);
    const [baselineForms, setBaselineForms] = useState<GoalFormState>(emptyState);
    const [archivedGoals, setArchivedGoals] = useState<GoalApi[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [deletingKey, setDeletingKey] = useState<string | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [goalFilter, setGoalFilter] = useState<GoalFilter>('all');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);
    const [staleDraftSkipped, setStaleDraftSkipped] = useState(false);
    const [draftStorageAvailable, setDraftStorageAvailable] = useState(true);
    const [reloadToken, setReloadToken] = useState(0);
    const discardDraftOnReloadRef = useRef(false);
    const addRequestHandledRef = useRef(false);
    const focusRequestHandledRef = useRef<string | null>(null);
    const archivedDetailsRef = useRef<HTMLDetailsElement | null>(null);
    const [focusedGoalId, setFocusedGoalId] = useState<string | null>(null);
    const isReadOnly = user?.membershipStatus === 'WITHDRAWN';
    const hasLocalChanges = loaded && goalStateKey(forms) !== goalStateKey(baselineForms);
    const dirty = !isReadOnly && hasLocalChanges;
    const confirmPageExit = useUnsavedChangesWarning(hasLocalChanges);
    const busy = savingKey !== null || deletingKey !== null;

    useEffect(() => {
        const controller = new AbortController();

        const loadGoals = async () => {
            setLoading(true);
            setError('');
            setConflict(false);
            try {
                const response = await fetch('/api/goals', { credentials: 'include',
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => null) as {
                    error?: string;
                    user?: UserInfo;
                    goals?: unknown[];
                    archivedGoals?: unknown[];
                } | null;

                if (response.status === 401) {
                    setLocation(loginHref(`${window.location.pathname}${window.location.search}`, 'user'));
                    return;
                }
                if (response.status === 403) {
                    setLocation('/admin/users');
                    return;
                }
                if (
                    !response.ok
                    || !data?.user
                    || typeof data.user.id !== 'string'
                    || typeof data.user.displayName !== 'string'
                    || (data.user.membershipStatus !== 'ACTIVE' && data.user.membershipStatus !== 'WITHDRAWN')
                    || !Array.isArray(data.goals)
                    || !Array.isArray(data.archivedGoals)
                ) {
                    setError(data?.error ?? '大会目標を読み込めませんでした');
                    return;
                }

                const goals = data.goals.map(parseGoalApi);
                const archived = data.archivedGoals.map(parseGoalApi);
                if (
                    goals.some((goal) => goal === null || !goal.isActive)
                    || archived.some((goal) => goal === null || goal.isActive)
                ) {
                    setError('受信した大会目標の形式が正しくありません');
                    return;
                }

                const validGoals = goals as GoalApi[];
                const readOnly = data.user.membershipStatus === 'WITHDRAWN';
                const nextState: GoalFormState = {
                    goals: sortGoalsByDate(validGoals.map(goalToForm)),
                    newGoal: emptyGoal('next_meet'),
                    queuedGoals: [],
                };
                setBaselineForms(nextState);

                const key = draftKey(data.user.id);
                if (discardDraftOnReloadRef.current) {
                    setDraftStorageAvailable(removeTabDraft(key));
                    discardDraftOnReloadRef.current = false;
                }
                const savedDraft = readTabDraft(key);
                const restored = !readOnly && savedDraft.value ? parseGoalDraft(savedDraft.value) : null;
                if (!readOnly && savedDraft.value && !restored) removeTabDraft(key);
                const mergedDraft = restored ? mergeGoalDraft(nextState, restored) : null;
                const loadedState = mergedDraft?.state ?? nextState;
                const firstChangedGoal = loadedState.goals.find((goal) => {
                    const serverGoal = nextState.goals.find((item) => item.id === goal.id);
                    return serverGoal && !goalFormsEqual(goal, serverGoal);
                });

                setUser(data.user);
                setArchivedGoals(archived as GoalApi[]);
                setForms(loadedState);
                setEditingKey(readOnly
                    ? null
                    : goalHasUserInput(loadedState.newGoal)
                        ? 'new'
                        : firstChangedGoal?.id ?? null);
                setDraftRestored(Boolean(
                    mergedDraft
                    && goalStateKey(loadedState) !== goalStateKey(nextState)
                ));
                setStaleDraftSkipped(Boolean(mergedDraft?.skippedStaleDraft));
                setDraftStorageAvailable(savedDraft.durable);
                setLoaded(true);
            } catch (loadError) {
                if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
                setError('通信を確認して、もう一度お試しください');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void loadGoals();
        return () => controller.abort();
    }, [reloadToken]);

    useEffect(() => {
        if (!loaded || !user || isReadOnly) return;
        const available = dirty
            ? writeTabDraft(draftKey(user.id), JSON.stringify(forms))
            : removeTabDraft(draftKey(user.id));
        const timeout = window.setTimeout(() => setDraftStorageAvailable(available), 0);
        return () => window.clearTimeout(timeout);
    }, [dirty, forms, isReadOnly, loaded, user]);

    useEffect(() => {
        if (
            !loaded
            || addRequestHandledRef.current
            || new URLSearchParams(window.location.search).get('add') !== '1'
        ) return;
        addRequestHandledRef.current = true;
        setLocation('/goals');
        if (isReadOnly) return;
        const frame = window.requestAnimationFrame(() => {
            setEditingKey('new');
            window.requestAnimationFrame(() => {
                document.getElementById('new-goal-meet-name')?.focus();
            });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [isReadOnly, loaded]);

    useEffect(() => {
        if (!loaded) return;
        const query = new URLSearchParams(window.location.search);
        const focusId = query.get('focus');
        if (!focusId || query.get('add') === '1' || focusRequestHandledRef.current === focusId) return;
        focusRequestHandledRef.current = focusId;

        const isActiveGoal = forms.goals.some((goal) => goal.id === focusId);
        const isArchivedGoal = archivedGoals.some((goal) => goal.id === focusId);
        if (!isActiveGoal && !isArchivedGoal) return;

        if (isArchivedGoal && archivedDetailsRef.current) archivedDetailsRef.current.open = true;
        let innerFrame = 0;
        const frame = window.requestAnimationFrame(() => {
            setGoalFilter('all');
            setFocusedGoalId(focusId);
            innerFrame = window.requestAnimationFrame(() => {
                const target = document.getElementById(`goal-card-${focusId}`);
                target?.scrollIntoView({ block: 'center' });
                target?.focus({ preventScroll: true });
            });
        });
        return () => {
            window.cancelAnimationFrame(frame);
            window.cancelAnimationFrame(innerFrame);
        };
    }, [archivedGoals, forms.goals, loaded]);

    const clearFeedback = () => {
        setMessage('');
        setError('');
        setConflict(false);
        setDraftRestored(false);
        setStaleDraftSkipped(false);
    };

    const updateSavedGoal = (
        id: string,
        field: EditableGoalField,
        value: string,
    ) => {
        clearFeedback();
        setForms((current) => ({
            ...current,
            goals: current.goals.map((goal) => goal.id === id
                ? { ...goal, [field]: value }
                : goal),
        }));
    };

    const updateNewGoal = (field: EditableGoalField, value: string) => {
        clearFeedback();
        setForms((current) => ({
            ...current,
            newGoal: { ...current.newGoal, [field]: value },
        }));
    };

    const updateNewGoalType = (type: GoalType) => {
        clearFeedback();
        setForms((current) => ({
            ...current,
            newGoal: {
                ...current.newGoal,
                type,
                targetDate: type === 'annual'
                    ? `${currentJSTYear()}-12-31`
                    : current.newGoal.type === 'annual'
                        ? ''
                        : current.newGoal.targetDate,
            },
        }));
    };

    const saveGoal = async (goal: GoalForm, key: string) => {
        if (isReadOnly) {
            setError('退会中のため、大会目標の新規入力や更新はできません。');
            return;
        }
        const title = goal.title.trim();
        const details = goal.details.trim();
        if (!title) {
            setError(goal.type === 'milestone' ? '出場したい大会を入力してください' : '目標を入力してください');
            return;
        }
        if ((goal.type === 'annual' || goal.type === 'milestone') && !goal.targetDate) {
            setError(goal.type === 'annual'
                ? '年間目標の対象年を選んでください'
                : '大会に出場したい期限を選んでください');
            return;
        }

        setSavingKey(key);
        setMessage('');
        setError('');
        setConflict(false);
        try {
            const creating = goal.id === null;
            const response = await fetch(creating ? '/api/goals' : `/api/goals/${encodeURIComponent(goal.id!)}`, {
                credentials: 'include',
                method: creating ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(creating
                    ? {
                        type: goal.type,
                        title,
                        details: details || null,
                        targetDate: goal.targetDate || null,
                    }
                    : {
                        baseRevision: goal.revision,
                        title,
                        details: details || null,
                        targetDate: goal.targetDate || null,
                    }),
            });
            const data = await response.json().catch(() => null) as {
                code?: string;
                error?: string;
                goal?: unknown;
            } | null;

            if (response.status === 401) {
                setLocation(loginHref(`${window.location.pathname}${window.location.search}`, 'user'));
                return;
            }
            if (response.status === 409) {
                setConflict(data?.code === 'GOAL_VERSION_CONFLICT');
                setError(data?.error ?? '別の画面でこの目標が更新されました');
                return;
            }
            if (response.status === 403 && data?.code === 'MEMBERSHIP_WITHDRAWN') {
                setUser((current) => current ? { ...current, membershipStatus: 'WITHDRAWN' } : current);
                setEditingKey(null);
                setError('退会または保護者同意の撤回により保存できませんでした。現在の入力は未保存です。必要な内容をコピーしてください。');
                return;
            }
            if (!response.ok) {
                setError(data?.error ?? '目標を保存できませんでした');
                return;
            }

            const parsedGoal = parseGoalApi(data?.goal);
            if (!parsedGoal || !parsedGoal.isActive) {
                setError('保存結果を確認できませんでした。再読み込みして内容を確認してください');
                return;
            }
            const saved = goalToForm(parsedGoal);
            const applySavedGoals = (current: GoalFormState): GoalForm[] => sortGoalsByDate(creating
                ? [...current.goals, saved]
                : current.goals.map((item) => item.id === saved.id ? saved : item));
            setBaselineForms((current) => ({
                goals: applySavedGoals(current),
                newGoal: emptyGoal('next_meet'),
                queuedGoals: [],
            }));
            setForms((current) => ({
                goals: applySavedGoals(current),
                newGoal: creating
                    ? current.queuedGoals[0] ?? emptyGoal('next_meet')
                    : current.newGoal,
                queuedGoals: creating ? current.queuedGoals.slice(1) : current.queuedGoals,
            }));
            const hasNextRestoredDraft = creating && forms.queuedGoals.length > 0;
            setEditingKey(hasNextRestoredDraft ? 'new' : null);
            if (!hasNextRestoredDraft) {
                setDraftRestored(false);
                setStaleDraftSkipped(false);
            }
            window.requestAnimationFrame(() => {
                document.getElementById(hasNextRestoredDraft
                    ? 'new-goal-meet-name'
                    : `goal-edit-${saved.id}`)?.focus();
            });
            setMessage(hasNextRestoredDraft
                ? '大会目標を保存しました。次の復元下書きを表示しています'
                : '大会目標を保存しました');
        } catch {
            setError('通信を確認して、もう一度お試しください');
        } finally {
            setSavingKey(null);
        }
    };

    const archiveGoal = async (goal: GoalForm, key: string) => {
        if (isReadOnly) {
            setError('退会中のため、大会目標の新規入力や更新はできません。');
            return;
        }
        if (!goal.id || goal.revision === null) return;
        const baselineGoal = baselineForms.goals.find((item) => item.id === goal.id);
        const hasUnsavedChanges = Boolean(
            baselineGoal && !goalFormsEqual(goal, baselineGoal),
        );
        const confirmation = hasUnsavedChanges
            ? '保存していない変更は反映されません。この目標を過去の目標に移しますか？'
            : 'この目標を過去の目標に移しますか？';
        if (!window.confirm(confirmation)) return;

        setDeletingKey(key);
        setMessage('');
        setError('');
        setConflict(false);
        try {
            const response = await fetch(`/api/goals/${encodeURIComponent(goal.id)}`, {
                credentials: 'include',
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseRevision: goal.revision }),
            });
            const data = await response.json().catch(() => null) as {
                code?: string;
                error?: string;
                goal?: unknown;
            } | null;

            if (response.status === 401) {
                setLocation(loginHref(`${window.location.pathname}${window.location.search}`, 'user'));
                return;
            }
            if (response.status === 409) {
                setConflict(true);
                setError(data?.error ?? '別の画面でこの目標が更新されました');
                return;
            }
            if (response.status === 403 && data?.code === 'MEMBERSHIP_WITHDRAWN') {
                setUser((current) => current ? { ...current, membershipStatus: 'WITHDRAWN' } : current);
                setEditingKey(null);
                setError('退会または保護者同意の撤回により保存できませんでした。現在の入力は未保存です。必要な内容をコピーしてください。');
                return;
            }
            if (!response.ok) {
                setError(data?.error ?? '目標を過去の目標に移せませんでした');
                return;
            }

            const archivedGoal = parseGoalApi(data?.goal);
            if (!archivedGoal || archivedGoal.isActive) {
                setError('移動結果を確認できませんでした。再読み込みして内容を確認してください');
                return;
            }

            setBaselineForms((current) => ({
                ...current,
                goals: current.goals.filter((item) => item.id !== goal.id),
            }));
            setForms((current) => ({
                ...current,
                goals: current.goals.filter((item) => item.id !== goal.id),
            }));
            setEditingKey(null);
            setArchivedGoals((current) => [
                archivedGoal,
                ...current.filter((item) => item.id !== archivedGoal.id),
            ]);
            setMessage('目標を過去の目標に移しました');
        } catch {
            setError('通信を確認して、もう一度お試しください');
        } finally {
            setDeletingKey(null);
        }
    };

    const deleteArchivedGoal = async (goal: GoalApi) => {
        if (isReadOnly) {
            setError('退会中のため、大会目標の新規入力や更新はできません。');
            return;
        }
        const key = `archived-${goal.id}`;
        if (!window.confirm('この過去の目標を完全に削除します。元に戻せません。削除しますか？')) {
            return;
        }

        setDeletingKey(key);
        setMessage('');
        setError('');
        setConflict(false);
        try {
            const response = await fetch(`/api/goals/${encodeURIComponent(goal.id)}/permanent`, {
                credentials: 'include',
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseRevision: goal.revision }),
            });
            const data = await response.json().catch(() => null) as {
                code?: string;
                error?: string;
            } | null;

            if (response.status === 401) {
                setLocation(loginHref(`${window.location.pathname}${window.location.search}`, 'user'));
                return;
            }
            if (response.status === 409) {
                setConflict(data?.code === 'GOAL_VERSION_CONFLICT');
                setError(data?.error ?? '別の画面でこの目標が更新されました');
                return;
            }
            if (response.status === 403 && data?.code === 'MEMBERSHIP_WITHDRAWN') {
                setUser((current) => current ? { ...current, membershipStatus: 'WITHDRAWN' } : current);
                setEditingKey(null);
                setError('退会または保護者同意の撤回により保存できませんでした。現在の入力は未保存です。必要な内容をコピーしてください。');
                return;
            }
            if (!response.ok) {
                setError(data?.error ?? '過去の目標を削除できませんでした');
                return;
            }

            setArchivedGoals((current) => current.filter((item) => item.id !== goal.id));
            setMessage('過去の目標を完全に削除しました');
        } catch {
            setError('通信を確認して、もう一度お試しください');
        } finally {
            setDeletingKey(null);
        }
    };

    const reloadLatest = () => {
        if (dirty && !window.confirm('保存していない変更を破棄して、最新の目標を読み込みますか？')) return;
        discardDraftOnReloadRef.current = true;
        setLoading(true);
        setLoaded(false);
        setReloadToken((value) => value + 1);
    };

    const openNewGoal = () => {
        if (isReadOnly) return;
        clearFeedback();
        setGoalFilter('all');
        setEditingKey('new');
        window.requestAnimationFrame(() => {
            document.getElementById('new-goal-meet-name')?.focus();
        });
    };

    const cancelNewGoal = () => {
        const blank = emptyGoal('next_meet');
        if (goalHasUserInput(forms.newGoal) && !window.confirm('入力中の新しい目標を破棄しますか？')) {
            return;
        }
        clearFeedback();
        const hasNextRestoredDraft = forms.queuedGoals.length > 0;
        setForms((current) => ({
            ...current,
            newGoal: current.queuedGoals[0] ?? blank,
            queuedGoals: current.queuedGoals.slice(1),
        }));
        setBaselineForms((current) => ({
            ...current,
            newGoal: blank,
            queuedGoals: [],
        }));
        setEditingKey(hasNextRestoredDraft ? 'new' : null);
        if (hasNextRestoredDraft) {
            setMessage('次の復元下書きを表示しています');
            window.requestAnimationFrame(() => {
                document.getElementById('new-goal-meet-name')?.focus();
            });
        }
    };

    const today = currentJSTDate();
    const nextUpcomingGoalId = findNextMeetGoalId(
        forms.goals.filter((goal): goal is GoalForm & { id: string } => goal.id !== null),
        today,
    );
    const filteredGoals = goalFilter === 'all'
        ? forms.goals
        : forms.goals.filter((goal) => goal.type === goalFilter);

    if (loading && !loaded) {
        return (
            <>
                <Nav />
                <main id="main-content" className="container container-narrow">
                    <div className="loading-state" role="status">大会目標を読み込んでいます…</div>
                </main>
            </>
        );
    }

    if (!loaded) {
        return (
            <>
                <Nav />
                <main id="main-content" className="container container-narrow">
                    <div className="alert alert-danger" role="alert">
                        {error || '大会目標を読み込めませんでした'}
                    </div>
                    <button type="button" className="btn btn-primary" onClick={reloadLatest}>
                        もう一度読み込む
                    </button>
                </main>
            </>
        );
    }

    return (
        <>
            <Nav userName={user?.displayName} beforeLogout={confirmPageExit} />
            <main id="main-content" className="container container-narrow goals-page">
                <header className="goals-page-header">
                    <div className="goals-page-title-row">
                        <div>
                            <p className="eyebrow">Race goals</p>
                            <h1 className="page-title">大会目標</h1>
                            <p className="goals-active-count">設定中 {forms.goals.length}件</p>
                        </div>
                        {!isReadOnly && (
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={editingKey === 'new' ? cancelNewGoal : openNewGoal}
                                disabled={busy}
                                aria-expanded={editingKey === 'new'}
                                aria-controls="new-goal-form"
                            >
                                <Plus aria-hidden="true" size={20}  />
                                {editingKey === 'new' ? '追加を閉じる' : '目標を追加'}
                            </button>
                        )}
                    </div>
                    <p className="muted">大会ごとにいくつでも追加して、日付の近い目標から確認できます。</p>
                </header>

                {isReadOnly && (
                    <div className="alert alert-info" role="status">
                        退会または保護者同意の撤回後は閲覧専用です。過去の大会目標は引き続き確認できます。
                    </div>
                )}

                {error && (
                    <div className={`alert ${conflict ? 'alert-warning' : 'alert-danger'} goals-feedback`} role="alert">
                        <span>{error}</span>
                        {conflict && (
                            <button type="button" className="btn btn-secondary btn-small" onClick={reloadLatest}>
                                最新の目標を読み込む
                            </button>
                        )}
                    </div>
                )}
                {message && <p className="alert alert-info goals-feedback" role="status">{message}</p>}
                {draftRestored && (
                    <p className="alert alert-info" role="status">
                        {forms.queuedGoals.length > 0
                            ? `未保存の下書きを${forms.queuedGoals.length + 1}件復元しました。保存または破棄すると、次の下書きを表示します。`
                            : 'このタブに残っていた未保存の下書きを復元しました。'}
                    </p>
                )}
                {staleDraftSkipped && (
                    <p className="alert alert-warning" role="status">
                        別の画面で更新された目標があるため、一部の古い下書きは復元しませんでした。
                    </p>
                )}
                {!isReadOnly && dirty && !draftStorageAvailable && (
                    <p className="alert alert-warning">
                        下書きはこのタブ内だけに一時保存しています。閉じる前に目標を保存してください。
                    </p>
                )}

                <section className="goals-milestone-section goals-active-section" aria-labelledby="active-goals-heading">
                    <div className="goals-section-heading">
                        <span className="goal-card-icon" aria-hidden="true">
                            <Flag size={28}  />
                        </span>
                        <div>
                            <p className="goal-card-kicker">今のゴール</p>
                            <h2 id="active-goals-heading" className="section-title">設定中の大会目標</h2>
                            <p className="muted">大会・年間・出場目標をまとめて、近い日付から表示します。</p>
                        </div>
                    </div>

                    {!isReadOnly && editingKey === 'new' && (
                        <form
                            id="new-goal-form"
                            className="card goal-card goal-new-milestone goal-new-inline"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void saveGoal(forms.newGoal, 'new-goal');
                            }}
                            aria-labelledby="new-goal-heading"
                        >
                            <div className="goal-new-heading">
                                <span className="goal-new-icon" aria-hidden="true">
                                    <Plus size={22}  />
                                </span>
                                <div>
                                    <h3 id="new-goal-heading">新しい大会目標</h3>
                                    <p className="muted">種類を選び、大会名・日付・目標の順に入力します。</p>
                                </div>
                            </div>
                            <fieldset className="goal-type-fieldset">
                                <legend className="form-label">目標の種類</legend>
                                <div className="goal-type-options">
                                    {(['next_meet', 'annual', 'milestone'] as const).map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            className={`goal-type-option${forms.newGoal.type === type ? ' goal-type-option-selected' : ''}`}
                                            aria-pressed={forms.newGoal.type === type}
                                            onClick={() => updateNewGoalType(type)}
                                            disabled={busy}
                                        >
                                            {GOAL_TYPE_LABELS[type]}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                            <GoalFields
                                form={forms.newGoal}
                                idPrefix="new-goal"
                                variant={forms.newGoal.type}
                                disabled={busy}
                                onChange={updateNewGoal}
                            />
                            <div className="goal-actions">
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={
                                        busy
                                        || !forms.newGoal.title.trim()
                                        || ((forms.newGoal.type === 'annual' || forms.newGoal.type === 'milestone')
                                            && !forms.newGoal.targetDate)
                                    }
                                >
                                    <Save aria-hidden="true" size={20}  />
                                    {savingKey === 'new-goal' ? '追加中…' : 'この目標を追加'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={cancelNewGoal}
                                    disabled={busy}
                                >
                                    キャンセル
                                </button>
                            </div>
                        </form>
                    )}

                    {forms.goals.length >= 6 && (
                        <div className="goal-filter-options" role="group" aria-label="大会目標の絞り込み">
                            {(['all', 'next_meet', 'annual', 'milestone'] as const).map((filter) => (
                                <button
                                    key={filter}
                                    type="button"
                                    className={`goal-filter-option${goalFilter === filter ? ' goal-filter-option-selected' : ''}`}
                                    aria-pressed={goalFilter === filter}
                                    onClick={() => setGoalFilter(filter)}
                                >
                                    {GOAL_FILTER_LABELS[filter]}
                                </button>
                            ))}
                        </div>
                    )}

                    {forms.goals.length === 0 && editingKey !== 'new' && (
                        <div className="goal-empty-state">
                            <Clock aria-hidden="true" size={30} />
                            <div>
                                <p><strong>大会目標はまだありません</strong></p>
                                <p>大会名から気軽に残せます。</p>
                            </div>
                            {!isReadOnly && (
                                <button type="button" className="btn btn-primary btn-small" onClick={openNewGoal}>
                                    最初の目標を追加
                                </button>
                            )}
                        </div>
                    )}

                    <div className="goals-milestone-list">
                        {filteredGoals.map((goal) => {
                            const key = `goal-${goal.id}`;
                            const baselineGoal = baselineForms.goals.find((item) => item.id === goal.id);
                            const changed = !baselineGoal || !goalFormsEqual(goal, baselineGoal);
                            const displayGoal = getCompetitionGoalDisplayValues(goal);
                            const target = formatGoalTarget(goal);
                            const isEditing = !isReadOnly && editingKey === goal.id;
                            const isPast = isCompetitionGoalElapsed(goal, today);
                            return (
                                <article
                                    key={goal.id}
                                    id={`goal-card-${goal.id}`}
                                    tabIndex={-1}
                                    aria-labelledby={`goal-heading-${goal.id}`}
                                    className={`card goal-card goal-list-card${isEditing ? ' goal-list-card-editing' : ''}${focusedGoalId === goal.id ? ' goal-card-focused' : ''}`}
                                >
                                    <div className="goal-list-summary">
                                        <div className="goal-list-summary-main">
                                            <div className="goal-list-badges">
                                                <span className="badge badge-secondary">{GOAL_TYPE_LABELS[goal.type]}</span>
                                                {goal.id === nextUpcomingGoalId && (
                                                    <span className="badge badge-primary">次の大会</span>
                                                )}
                                                {isPast && (
                                                    <span className="badge badge-secondary">
                                                        {goal.type === 'milestone'
                                                            ? '期限経過'
                                                            : goal.type === 'annual'
                                                                ? '対象年終了'
                                                                : '開催済み'}
                                                    </span>
                                                )}
                                                {changed && <span className="badge badge-secondary">未保存</span>}
                                            </div>
                                            <h3 id={`goal-heading-${goal.id}`}>{displayGoal.meetName || displayGoal.goalText || '大会名未設定'}</h3>
                                            {displayGoal.meetName && displayGoal.goalText && (
                                                <p>{displayGoal.goalText}</p>
                                            )}
                                        </div>
                                        <div className="goal-list-summary-actions">
                                            <span className="goal-deadline-badge">
                                                <Calendar aria-hidden="true" size={16} />
                                                {target || '日付未定'}
                                            </span>
                                            {!isReadOnly && (
                                                <button
                                                    id={`goal-edit-${goal.id}`}
                                                    type="button"
                                                    className="btn btn-secondary btn-small"
                                                    aria-expanded={isEditing}
                                                    aria-controls={`${key}-editor`}
                                                    onClick={() => setEditingKey(isEditing ? null : goal.id)}
                                                    disabled={busy}
                                                >
                                                    {isEditing ? '閉じる' : '編集'}
                                                    <ChevronDown
                                                        className={`goal-edit-caret${isEditing ? ' goal-edit-caret-open' : ''}`}
                                                        aria-hidden="true"
                                                        size={16}
                                                        
                                                    />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {isEditing && (
                                        <form
                                            id={`${key}-editor`}
                                            className="goal-list-editor"
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                void saveGoal(goal, key);
                                            }}
                                        >
                                            <GoalFields
                                                form={goal}
                                                idPrefix={key}
                                                variant={goal.type}
                                                disabled={busy}
                                                onChange={(field, value) => updateSavedGoal(goal.id!, field, value)}
                                            />
                                            <div className="goal-actions">
                                                <button
                                                    type="submit"
                                                    className="btn btn-primary"
                                                    disabled={
                                                        busy
                                                        || !goal.title.trim()
                                                        || ((goal.type === 'annual' || goal.type === 'milestone') && !goal.targetDate)
                                                        || !changed
                                                    }
                                                >
                                                    <Save aria-hidden="true" size={20}  />
                                                    {savingKey === key ? '更新中…' : '変更を保存'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary goal-delete-button"
                                                    onClick={() => void archiveGoal(goal, key)}
                                                    disabled={busy}
                                                >
                                                    <Archive aria-hidden="true" size={19} />
                                                    {deletingKey === key ? '移動中…' : '過去へ移す'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </article>
                            );
                        })}
                    </div>

                    {forms.goals.length > 0 && filteredGoals.length === 0 && (
                        <p className="empty-state">この種類の設定中目標はありません。</p>
                    )}
                </section>

                {archivedGoals.length > 0 && (
                    <details ref={archivedDetailsRef} className="card goals-history">
                        <summary>
                            <span className="goal-history-summary-title">
                                <Archive aria-hidden="true" size={21}  />
                                過去の目標
                            </span>
                            <span className="goal-history-summary-meta">
                                <span className="badge badge-secondary">{archivedGoals.length}件</span>
                                <ChevronDown className="goal-history-caret" aria-hidden="true" size={18}  />
                            </span>
                        </summary>
                        <div className="goals-history-list">
                            {archivedGoals.map((goal) => {
                                const target = formatGoalTarget(goal);
                                const displayGoal = getCompetitionGoalDisplayValues(goal);
                                return (
                                    <article
                                        key={goal.id}
                                        id={`goal-card-${goal.id}`}
                                        tabIndex={-1}
                                        aria-labelledby={`goal-heading-${goal.id}`}
                                        className={`goal-history-item${focusedGoalId === goal.id ? ' goal-card-focused' : ''}`}
                                    >
                                        <div className="goal-history-heading">
                                            <div>
                                                <p className="goal-card-kicker">{GOAL_TYPE_LABELS[goal.type]}</p>
                                                <h3 id={`goal-heading-${goal.id}`}>{displayGoal.meetName || displayGoal.goalText || '大会名未設定'}</h3>
                                            </div>
                                        </div>
                                        <dl className="goal-display-list">
                                            <div>
                                                <dt>大会名</dt>
                                                <dd>{displayGoal.meetName || '未設定'}</dd>
                                            </div>
                                            <div>
                                                <dt>日付</dt>
                                                <dd>{target || '未設定'}</dd>
                                            </div>
                                            <div>
                                                <dt>目標</dt>
                                                <dd>{displayGoal.goalText || '未設定'}</dd>
                                            </div>
                                        </dl>
                                        {!isReadOnly && (
                                            <div className="goal-history-actions">
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-small goal-delete-button"
                                                    onClick={() => void deleteArchivedGoal(goal)}
                                                    disabled={busy}
                                                    aria-label={`${displayGoal.meetName || '大会目標'}を完全に削除`}
                                                >
                                                    <Trash aria-hidden="true" size={17} />
                                                    {deletingKey === `archived-${goal.id}` ? '削除中…' : '完全に削除'}
                                                </button>
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    </details>
                )}

                <div className="goals-draft-status" aria-live="polite">
                    {isReadOnly
                        ? hasLocalChanges
                            ? '現在表示している未保存の下書きは反映されていません。必要な内容をコピーしてください'
                            : '退会中のため閲覧専用です'
                        : dirty
                            ? '未保存の変更は、このタブに下書き保存されています'
                            : 'すべての変更を保存済みです'}
                </div>
            </main>
        </>
    );
}
