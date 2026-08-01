import { parseDateOnly } from './date';
import {
    COMPETITION_GOAL_TYPES,
    type CompetitionGoalApiType,
    toCompetitionGoalDatabaseType,
} from './competition-goal-contract';
import {
    MAX_GOAL_DETAILS_LENGTH,
    MAX_GOAL_TITLE_LENGTH,
} from './limits';
import type { ValidationResult } from './validation';

const EARLIEST_GOAL_DATE = new Date('1970-01-01T00:00:00.000Z');
const LATEST_GOAL_DATE = new Date('2100-12-31T00:00:00.000Z');
const GOAL_TYPES = new Set<string>(COMPETITION_GOAL_TYPES);

function success<T>(value: T): ValidationResult<T> {
    return { ok: true, value };
}

function failure<T>(error: string): ValidationResult<T> {
    return { ok: false, error };
}

function parseRevision(value: unknown): ValidationResult<number> {
    if (
        typeof value !== 'number'
        || !Number.isSafeInteger(value)
        || value < 1
        || value > 2_147_483_646
    ) {
        return failure('更新情報が正しくありません。目標を再読み込みしてください');
    }
    return success(value);
}

function parseTitle(value: unknown): ValidationResult<string> {
    if (typeof value !== 'string' || !value.trim()) {
        return failure('目標を入力してください');
    }
    const title = value.trim();
    if (title.length > MAX_GOAL_TITLE_LENGTH) {
        return failure(`目標は${MAX_GOAL_TITLE_LENGTH}文字以内で入力してください`);
    }
    return success(title);
}

function parseDetails(value: unknown): ValidationResult<string | null> {
    if (value === undefined || value === null || value === '') return success(null);
    if (typeof value !== 'string') return failure('目標の詳細の形式が正しくありません');
    const details = value.trim();
    if (!details) return success(null);
    if (details.length > MAX_GOAL_DETAILS_LENGTH) {
        return failure(`目標の詳細は${MAX_GOAL_DETAILS_LENGTH.toLocaleString('ja-JP')}文字以内で入力してください`);
    }
    return success(details);
}

function parseTargetDate(value: unknown): ValidationResult<Date | null> {
    if (value === undefined || value === null || value === '') return success(null);
    if (typeof value !== 'string') return failure('目標日の形式が正しくありません');
    const date = parseDateOnly(value);
    if (!date || date < EARLIEST_GOAL_DATE || date > LATEST_GOAL_DATE) {
        return failure('目標日は1970年から2100年の間で入力してください');
    }
    return success(date);
}

export interface CompetitionGoalCreateInput {
    type: ReturnType<typeof toCompetitionGoalDatabaseType>;
    title: string;
    details: string | null;
    targetDate: Date | null;
}

export function parseCompetitionGoalCreateInput(
    body: Record<string, unknown>,
): ValidationResult<CompetitionGoalCreateInput> {
    const allowedFields = new Set(['type', 'title', 'details', 'targetDate']);
    if (Object.keys(body).some((key) => !allowedFields.has(key))) {
        return failure('リクエストの形式が正しくありません');
    }

    if (typeof body.type !== 'string' || !GOAL_TYPES.has(body.type)) {
        return failure('目標の種類が正しくありません');
    }
    const type = body.type as CompetitionGoalApiType;
    const title = parseTitle(body.title);
    if (!title.ok) return title;
    const details = parseDetails(body.details);
    if (!details.ok) return details;
    const targetDate = parseTargetDate(body.targetDate);
    if (!targetDate.ok) return targetDate;
    if ((type === 'annual' || type === 'milestone') && !targetDate.value) {
        return failure(type === 'annual' ? '対象年を入力してください' : '期限を入力してください');
    }
    if (
        type === 'annual'
        && targetDate.value
        && (targetDate.value.getUTCMonth() !== 11 || targetDate.value.getUTCDate() !== 31)
    ) {
        return failure('年間目標は対象年で入力してください');
    }

    return success({
        type: toCompetitionGoalDatabaseType(type),
        title: title.value,
        details: details.value,
        targetDate: targetDate.value,
    });
}

export interface CompetitionGoalUpdateInput {
    baseRevision: number;
    title?: string;
    details?: string | null;
    targetDate?: Date | null;
    isActive?: boolean;
}

export function parseCompetitionGoalUpdateInput(
    body: Record<string, unknown>,
): ValidationResult<CompetitionGoalUpdateInput> {
    const allowedFields = new Set(['baseRevision', 'title', 'details', 'targetDate', 'isActive']);
    if (Object.keys(body).some((key) => !allowedFields.has(key))) {
        return failure('リクエストの形式が正しくありません');
    }

    const baseRevision = parseRevision(body.baseRevision);
    if (!baseRevision.ok) return baseRevision;
    const result: CompetitionGoalUpdateInput = { baseRevision: baseRevision.value };

    if (Object.hasOwn(body, 'title')) {
        const title = parseTitle(body.title);
        if (!title.ok) return title;
        result.title = title.value;
    }
    if (Object.hasOwn(body, 'details')) {
        const details = parseDetails(body.details);
        if (!details.ok) return details;
        result.details = details.value;
    }
    if (Object.hasOwn(body, 'targetDate')) {
        const targetDate = parseTargetDate(body.targetDate);
        if (!targetDate.ok) return targetDate;
        result.targetDate = targetDate.value;
    }
    if (Object.hasOwn(body, 'isActive')) {
        if (typeof body.isActive !== 'boolean') return failure('目標の状態が正しくありません');
        result.isActive = body.isActive;
    }

    if (Object.keys(result).length === 1) return failure('変更する内容を入力してください');
    return success(result);
}

export function parseCompetitionGoalDeleteInput(
    body: Record<string, unknown>,
): ValidationResult<{ baseRevision: number }> {
    if (Object.keys(body).some((key) => key !== 'baseRevision')) {
        return failure('リクエストの形式が正しくありません');
    }
    const baseRevision = parseRevision(body.baseRevision);
    return baseRevision.ok ? success({ baseRevision: baseRevision.value }) : baseRevision;
}
