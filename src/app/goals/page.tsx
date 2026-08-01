'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveIcon } from '@phosphor-icons/react/dist/csr/Archive';
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown';
import { ClockCountdownIcon } from '@phosphor-icons/react/dist/csr/ClockCountdown';
import { FlagCheckeredIcon } from '@phosphor-icons/react/dist/csr/FlagCheckered';
import { FloppyDiskIcon } from '@phosphor-icons/react/dist/csr/FloppyDisk';
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus';
import { TargetIcon } from '@phosphor-icons/react/dist/csr/Target';
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash';
import { TrophyIcon } from '@phosphor-icons/react/dist/csr/Trophy';
import Nav from '@/components/Nav';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import {
    getCompetitionGoalDisplayValues,
    getCompetitionGoalFieldMapping,
} from '@/lib/competition-goal-display';
import {
    MAX_ACTIVE_MILESTONE_GOALS,
    MAX_GOAL_DETAILS_LENGTH,
    MAX_GOAL_TITLE_LENGTH,
} from '@/lib/limits';
import { readTabDraft, removeTabDraft, writeTabDraft } from '@/lib/tab-draft-store';

type GoalType = 'next_meet' | 'annual' | 'milestone';
type EditableGoalField = 'title' | 'details' | 'targetDate';

interface UserInfo {
    id: string;
    displayName: string;
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
    nextMeet: GoalForm;
    annual: GoalForm;
    milestones: GoalForm[];
    newMilestone: GoalForm;
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
        nextMeet: emptyGoal('next_meet'),
        annual: emptyGoal('annual'),
        milestones: [],
        newMilestone: emptyGoal('milestone'),
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
        if (
            !Array.isArray(record.milestones)
            || record.milestones.length > MAX_ACTIVE_MILESTONE_GOALS
        ) return null;

        const nextMeet = parseGoalForm(record.nextMeet, 'next_meet');
        const annual = parseGoalForm(record.annual, 'annual');
        const newMilestone = parseGoalForm(record.newMilestone, 'milestone');
        const milestones = record.milestones.map((goal) => parseGoalForm(goal, 'milestone'));
        if (
            !nextMeet
            || !annual
            || !newMilestone
            || newMilestone.id !== null
            || milestones.some((goal) => goal === null || goal.id === null)
        ) {
            return null;
        }

        return {
            nextMeet,
            annual,
            newMilestone,
            milestones: milestones as GoalForm[],
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

function draftKey(userId: string): string {
    return `swim-story:draft:goals:${userId}`;
}

function sortMilestones(goals: GoalForm[]): GoalForm[] {
    return [...goals].sort((left, right) => {
        if (!left.targetDate) return 1;
        if (!right.targetDate) return -1;
        return left.targetDate.localeCompare(right.targetDate);
    });
}

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
    next_meet: '次の大会',
    annual: '年間目標',
    milestone: '期限つき目標',
};

function formatGoalTarget(goal: GoalApi): string | null {
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

    const mergeSingleton = (serverGoal: GoalForm, draftGoal: GoalForm): GoalForm => {
        if (serverGoal.id === null && draftGoal.id === null) return draftGoal;
        if (serverGoal.id === draftGoal.id && serverGoal.revision === draftGoal.revision) {
            return draftGoal;
        }
        skippedStaleDraft = true;
        return serverGoal;
    };

    const draftMilestones = new Map(
        draft.milestones
            .filter((goal): goal is GoalForm & { id: string } => goal.id !== null)
            .map((goal) => [goal.id, goal]),
    );
    const milestones = server.milestones.map((serverGoal) => {
        const draftGoal = serverGoal.id ? draftMilestones.get(serverGoal.id) : undefined;
        if (!draftGoal) return serverGoal;
        draftMilestones.delete(draftGoal.id);
        if (draftGoal.revision === serverGoal.revision) return draftGoal;
        skippedStaleDraft = true;
        return serverGoal;
    });
    if (draftMilestones.size > 0) skippedStaleDraft = true;

    return {
        state: {
            nextMeet: mergeSingleton(server.nextMeet, draft.nextMeet),
            annual: mergeSingleton(server.annual, draft.annual),
            milestones,
            newMilestone: draft.newMilestone,
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
                    <CalendarBlankIcon aria-hidden="true" size={18} weight="bold" />
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
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [forms, setForms] = useState<GoalFormState>(emptyState);
    const [baselineForms, setBaselineForms] = useState<GoalFormState>(emptyState);
    const [archivedGoals, setArchivedGoals] = useState<GoalApi[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [deletingKey, setDeletingKey] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);
    const [staleDraftSkipped, setStaleDraftSkipped] = useState(false);
    const [draftStorageAvailable, setDraftStorageAvailable] = useState(true);
    const [reloadToken, setReloadToken] = useState(0);
    const discardDraftOnReloadRef = useRef(false);
    const dirty = loaded && goalStateKey(forms) !== goalStateKey(baselineForms);
    const nextMeetChanged = !goalFormsEqual(forms.nextMeet, baselineForms.nextMeet);
    const annualChanged = !goalFormsEqual(forms.annual, baselineForms.annual);
    const confirmPageExit = useUnsavedChangesWarning(dirty);
    const busy = savingKey !== null || deletingKey !== null;

    useEffect(() => {
        const controller = new AbortController();

        const loadGoals = async () => {
            setLoading(true);
            setError('');
            setConflict(false);
            try {
                const response = await fetch('/api/goals', {
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
                    router.replace('/login');
                    return;
                }
                if (response.status === 403) {
                    router.replace('/admin/users');
                    return;
                }
                if (
                    !response.ok
                    || !data?.user
                    || typeof data.user.id !== 'string'
                    || typeof data.user.displayName !== 'string'
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
                const nextMeet = validGoals.find((goal) => goal.type === 'next_meet');
                const annual = validGoals.find((goal) => goal.type === 'annual');
                const nextState: GoalFormState = {
                    nextMeet: nextMeet
                        ? goalToForm(nextMeet)
                        : emptyGoal('next_meet'),
                    annual: annual
                        ? goalToForm(annual)
                        : emptyGoal('annual'),
                    milestones: sortMilestones(
                        validGoals.filter((goal) => goal.type === 'milestone').map(goalToForm),
                    ),
                    newMilestone: emptyGoal('milestone'),
                };
                setBaselineForms(nextState);

                const key = draftKey(data.user.id);
                if (discardDraftOnReloadRef.current) {
                    setDraftStorageAvailable(removeTabDraft(key));
                    discardDraftOnReloadRef.current = false;
                }
                const savedDraft = readTabDraft(key);
                const restored = savedDraft.value ? parseGoalDraft(savedDraft.value) : null;
                if (savedDraft.value && !restored) removeTabDraft(key);
                const mergedDraft = restored ? mergeGoalDraft(nextState, restored) : null;

                setUser(data.user);
                setArchivedGoals(archived as GoalApi[]);
                setForms(mergedDraft?.state ?? nextState);
                setDraftRestored(Boolean(
                    mergedDraft
                    && goalStateKey(mergedDraft.state) !== goalStateKey(nextState)
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
    }, [reloadToken, router]);

    useEffect(() => {
        if (!loaded || !user) return;
        const available = dirty
            ? writeTabDraft(draftKey(user.id), JSON.stringify(forms))
            : removeTabDraft(draftKey(user.id));
        const timeout = window.setTimeout(() => setDraftStorageAvailable(available), 0);
        return () => window.clearTimeout(timeout);
    }, [dirty, forms, loaded, user]);

    const clearFeedback = () => {
        setMessage('');
        setError('');
        setConflict(false);
        setDraftRestored(false);
        setStaleDraftSkipped(false);
    };

    const updateSingleton = (
        type: 'next_meet' | 'annual',
        field: EditableGoalField,
        value: string,
    ) => {
        clearFeedback();
        setForms((current) => ({
            ...current,
            [type === 'next_meet' ? 'nextMeet' : 'annual']: {
                ...current[type === 'next_meet' ? 'nextMeet' : 'annual'],
                [field]: value,
            },
        }));
    };

    const updateMilestone = (id: string, field: EditableGoalField, value: string) => {
        clearFeedback();
        setForms((current) => ({
            ...current,
            milestones: current.milestones.map((goal) => goal.id === id
                ? { ...goal, [field]: value }
                : goal),
        }));
    };

    const updateNewMilestone = (field: EditableGoalField, value: string) => {
        clearFeedback();
        setForms((current) => ({
            ...current,
            newMilestone: { ...current.newMilestone, [field]: value },
        }));
    };

    const saveGoal = async (goal: GoalForm, key: string) => {
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
                router.replace('/login');
                return;
            }
            if (response.status === 409) {
                setConflict(
                    data?.code === 'GOAL_VERSION_CONFLICT'
                    || data?.code === 'GOAL_SINGLETON_CONFLICT',
                );
                setError(data?.error ?? '別の画面でこの目標が更新されました');
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

            if (goal.type === 'next_meet') {
                setBaselineForms((current) => ({ ...current, nextMeet: saved }));
                setForms((current) => ({ ...current, nextMeet: saved }));
            } else if (goal.type === 'annual') {
                setBaselineForms((current) => ({ ...current, annual: saved }));
                setForms((current) => ({ ...current, annual: saved }));
            } else if (creating) {
                setBaselineForms((current) => ({
                    ...current,
                    milestones: sortMilestones([...current.milestones, saved]),
                    newMilestone: emptyGoal('milestone'),
                }));
                setForms((current) => ({
                    ...current,
                    milestones: sortMilestones([...current.milestones, saved]),
                    newMilestone: emptyGoal('milestone'),
                }));
            } else {
                setBaselineForms((current) => ({
                    ...current,
                    milestones: sortMilestones(current.milestones.map((item) => (
                        item.id === saved.id ? saved : item
                    ))),
                }));
                setForms((current) => ({
                    ...current,
                    milestones: sortMilestones(current.milestones.map((item) => (
                        item.id === saved.id ? saved : item
                    ))),
                }));
            }
            setMessage(goal.type === 'milestone' ? '大会への目標を保存しました' : '目標を保存しました');
        } catch {
            setError('通信を確認して、もう一度お試しください');
        } finally {
            setSavingKey(null);
        }
    };

    const archiveGoal = async (goal: GoalForm, key: string) => {
        if (!goal.id || goal.revision === null) return;
        const baselineGoal = goal.type === 'next_meet'
            ? baselineForms.nextMeet
            : goal.type === 'annual'
                ? baselineForms.annual
                : baselineForms.milestones.find((item) => item.id === goal.id);
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
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseRevision: goal.revision }),
            });
            const data = await response.json().catch(() => null) as {
                error?: string;
                goal?: unknown;
            } | null;

            if (response.status === 401) {
                router.replace('/login');
                return;
            }
            if (response.status === 409) {
                setConflict(true);
                setError(data?.error ?? '別の画面でこの目標が更新されました');
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

            if (goal.type === 'next_meet') {
                const blank = emptyGoal('next_meet');
                setBaselineForms((current) => ({ ...current, nextMeet: blank }));
                setForms((current) => ({ ...current, nextMeet: blank }));
            } else if (goal.type === 'annual') {
                const blank = emptyGoal('annual');
                setBaselineForms((current) => ({ ...current, annual: blank }));
                setForms((current) => ({ ...current, annual: blank }));
            } else {
                setBaselineForms((current) => ({
                    ...current,
                    milestones: current.milestones.filter((item) => item.id !== goal.id),
                }));
                setForms((current) => ({
                    ...current,
                    milestones: current.milestones.filter((item) => item.id !== goal.id),
                }));
            }
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
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseRevision: goal.revision }),
            });
            const data = await response.json().catch(() => null) as {
                code?: string;
                error?: string;
            } | null;

            if (response.status === 401) {
                router.replace('/login');
                return;
            }
            if (response.status === 409) {
                setConflict(data?.code === 'GOAL_VERSION_CONFLICT');
                setError(data?.error ?? '別の画面でこの目標が更新されました');
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
                    <p className="eyebrow">Race goals</p>
                    <h1 className="page-title">大会の目標</h1>
                    <p className="muted">次の一歩から、いつか立ちたい舞台まで。今の目標を言葉にしておこう。</p>
                </header>

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
                        このタブに残っていた未保存の下書きを復元しました。
                    </p>
                )}
                {staleDraftSkipped && (
                    <p className="alert alert-warning" role="status">
                        別の画面で更新された目標があるため、一部の古い下書きは復元しませんでした。
                    </p>
                )}
                {dirty && !draftStorageAvailable && (
                    <p className="alert alert-warning">
                        下書きはこのタブ内だけに一時保存しています。閉じる前に目標を保存してください。
                    </p>
                )}

                <section className="card goal-card goal-card-next" aria-labelledby="next-meet-heading">
                    <div className="goal-card-heading">
                        <span className="goal-card-icon" aria-hidden="true">
                            <FlagCheckeredIcon size={28} weight="fill" />
                        </span>
                        <div>
                            <p className="goal-card-kicker">いちばん近いゴール</p>
                            <h2 id="next-meet-heading" className="section-title">次の大会</h2>
                            <p className="muted">まずは1つだけ。次のレースで実現したいことを書こう。</p>
                        </div>
                        {forms.nextMeet.id && <span className="badge badge-primary">保存済み</span>}
                    </div>
                    <form onSubmit={(event) => {
                        event.preventDefault();
                        void saveGoal(forms.nextMeet, 'next-meet');
                    }}>
                        <GoalFields
                            form={forms.nextMeet}
                            idPrefix="next-meet"
                            variant="next_meet"
                            disabled={busy}
                            onChange={(field, value) => updateSingleton('next_meet', field, value)}
                        />
                        <div className="goal-actions">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={busy || !forms.nextMeet.title.trim() || !nextMeetChanged}
                            >
                                <FloppyDiskIcon aria-hidden="true" size={20} weight="bold" />
                                {savingKey === 'next-meet' ? '保存中…' : forms.nextMeet.id ? '次の大会を更新' : '次の大会を保存'}
                            </button>
                            {forms.nextMeet.id && (
                                <button
                                    type="button"
                                    className="btn btn-secondary goal-delete-button"
                                    onClick={() => void archiveGoal(forms.nextMeet, 'next-meet')}
                                    disabled={busy}
                                >
                                    <ArchiveIcon aria-hidden="true" size={19} />
                                    {deletingKey === 'next-meet' ? '移動中…' : '過去へ移す'}
                                </button>
                            )}
                        </div>
                    </form>
                </section>

                <section className="card goal-card" aria-labelledby="annual-heading">
                    <div className="goal-card-heading">
                        <span className="goal-card-icon goal-card-icon-annual" aria-hidden="true">
                            <TrophyIcon size={28} weight="fill" />
                        </span>
                        <div>
                            <p className="goal-card-kicker">1年のテーマ</p>
                            <h2 id="annual-heading" className="section-title">年間の大会目標</h2>
                            <p className="muted">1年を通して、どんな選手になりたいかを残そう。</p>
                        </div>
                        {forms.annual.id && <span className="badge badge-primary">保存済み</span>}
                    </div>
                    <form onSubmit={(event) => {
                        event.preventDefault();
                        void saveGoal(forms.annual, 'annual');
                    }}>
                        <GoalFields
                            form={forms.annual}
                            idPrefix="annual"
                            variant="annual"
                            disabled={busy}
                            onChange={(field, value) => updateSingleton('annual', field, value)}
                        />
                        <div className="goal-actions">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={
                                    busy
                                    || !forms.annual.title.trim()
                                    || !forms.annual.targetDate
                                    || !annualChanged
                                }
                            >
                                <FloppyDiskIcon aria-hidden="true" size={20} weight="bold" />
                                {savingKey === 'annual' ? '保存中…' : forms.annual.id ? '年間目標を更新' : '年間目標を保存'}
                            </button>
                            {forms.annual.id && (
                                <button
                                    type="button"
                                    className="btn btn-secondary goal-delete-button"
                                    onClick={() => void archiveGoal(forms.annual, 'annual')}
                                    disabled={busy}
                                >
                                    <ArchiveIcon aria-hidden="true" size={19} />
                                    {deletingKey === 'annual' ? '移動中…' : '過去へ移す'}
                                </button>
                            )}
                        </div>
                    </form>
                </section>

                <section className="goals-milestone-section" aria-labelledby="milestone-heading">
                    <div className="goals-section-heading">
                        <span className="goal-card-icon goal-card-icon-milestone" aria-hidden="true">
                            <TargetIcon size={28} weight="bold" />
                        </span>
                        <div>
                            <p className="goal-card-kicker">その先のゴール</p>
                            <h2 id="milestone-heading" className="section-title">いつまでに、どの大会へ？</h2>
                            <p className="muted">出場したい大会を{MAX_ACTIVE_MILESTONE_GOALS}件まで追加できます。</p>
                        </div>
                    </div>

                    {forms.milestones.length === 0 && (
                        <div className="goal-empty-state">
                            <ClockCountdownIcon aria-hidden="true" size={30} />
                            <p>まだ大会への目標はありません。下のフォームから最初の1つを追加しましょう。</p>
                        </div>
                    )}

                    <div className="goals-milestone-list">
                        {forms.milestones.map((goal, index) => {
                            const key = `milestone-${goal.id}`;
                            const baselineGoal = baselineForms.milestones.find((item) => item.id === goal.id);
                            const changed = !baselineGoal || !goalFormsEqual(goal, baselineGoal);
                            const displayGoal = getCompetitionGoalDisplayValues(goal);
                            return (
                                <form
                                    key={goal.id}
                                    className="card goal-card goal-milestone-card"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        void saveGoal(goal, key);
                                    }}
                                    aria-labelledby={`${key}-heading`}
                                >
                                    <div className="goal-milestone-heading">
                                        <div>
                                            <p className="goal-number">GOAL {index + 1}</p>
                                            <h3 id={`${key}-heading`}>{displayGoal.meetName || '大会名未設定'}</h3>
                                        </div>
                                        {goal.targetDate && (
                                            <span className="goal-deadline-badge">
                                                <CalendarBlankIcon aria-hidden="true" size={16} />
                                                {goal.targetDate.replaceAll('-', '.')}
                                            </span>
                                        )}
                                    </div>
                                    <GoalFields
                                        form={goal}
                                        idPrefix={key}
                                        variant="milestone"
                                        disabled={busy}
                                        onChange={(field, value) => updateMilestone(goal.id!, field, value)}
                                    />
                                    <div className="goal-actions">
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={busy || !goal.title.trim() || !goal.targetDate || !changed}
                                        >
                                            <FloppyDiskIcon aria-hidden="true" size={20} weight="bold" />
                                            {savingKey === key ? '更新中…' : 'この目標を更新'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary goal-delete-button"
                                            onClick={() => void archiveGoal(goal, key)}
                                            disabled={busy}
                                        >
                                            <ArchiveIcon aria-hidden="true" size={19} />
                                            {deletingKey === key ? '移動中…' : '過去へ移す'}
                                        </button>
                                    </div>
                                </form>
                            );
                        })}
                    </div>

                    <form
                        className="card goal-card goal-new-milestone"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void saveGoal(forms.newMilestone, 'new-milestone');
                        }}
                        aria-labelledby="new-milestone-heading"
                    >
                        <div className="goal-new-heading">
                            <span className="goal-new-icon" aria-hidden="true">
                                <PlusIcon size={22} weight="bold" />
                            </span>
                            <div>
                                <h3 id="new-milestone-heading">大会への目標を追加</h3>
                                <p className="muted">大会名、日付、目標の順に入力できます。</p>
                            </div>
                        </div>
                        <GoalFields
                            form={forms.newMilestone}
                            idPrefix="new-milestone"
                            variant="milestone"
                            disabled={busy || forms.milestones.length >= MAX_ACTIVE_MILESTONE_GOALS}
                            onChange={updateNewMilestone}
                        />
                        {forms.milestones.length >= MAX_ACTIVE_MILESTONE_GOALS && (
                            <p className="alert alert-warning">
                                登録上限の{MAX_ACTIVE_MILESTONE_GOALS}件に達しています。追加するには、現在の目標を1件「過去へ移す」必要があります。
                            </p>
                        )}
                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={
                                busy
                                || forms.milestones.length >= MAX_ACTIVE_MILESTONE_GOALS
                                || !forms.newMilestone.title.trim()
                                || !forms.newMilestone.targetDate
                            }
                        >
                            <PlusIcon aria-hidden="true" size={20} weight="bold" />
                            {savingKey === 'new-milestone' ? '追加中…' : '大会への目標を追加'}
                        </button>
                    </form>
                </section>

                {archivedGoals.length > 0 && (
                    <details className="card goals-history">
                        <summary>
                            <span className="goal-history-summary-title">
                                <ArchiveIcon aria-hidden="true" size={21} weight="bold" />
                                過去の目標
                            </span>
                            <span className="goal-history-summary-meta">
                                <span className="badge badge-secondary">{archivedGoals.length}件</span>
                                <CaretDownIcon className="goal-history-caret" aria-hidden="true" size={18} weight="bold" />
                            </span>
                        </summary>
                        <div className="goals-history-list">
                            {archivedGoals.map((goal) => {
                                const target = formatGoalTarget(goal);
                                const displayGoal = getCompetitionGoalDisplayValues(goal);
                                return (
                                    <article key={goal.id} className="goal-history-item">
                                        <div className="goal-history-heading">
                                            <div>
                                                <p className="goal-card-kicker">{GOAL_TYPE_LABELS[goal.type]}</p>
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
                                        <div className="goal-history-actions">
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-small goal-delete-button"
                                                onClick={() => void deleteArchivedGoal(goal)}
                                                disabled={busy}
                                                aria-label={`${displayGoal.meetName || '大会目標'}を完全に削除`}
                                            >
                                                <TrashIcon aria-hidden="true" size={17} />
                                                {deletingKey === `archived-${goal.id}` ? '削除中…' : '完全に削除'}
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </details>
                )}

                <div className="goals-draft-status" aria-live="polite">
                    {dirty ? '未保存の変更は、このタブに下書き保存されています' : 'すべての変更を保存済みです'}
                </div>
            </main>
        </>
    );
}
