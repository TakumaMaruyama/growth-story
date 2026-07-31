import { parseDailyLogDate } from './date';
import { getPasswordValidationError } from './password';
import {
  MAX_DAILY_TEXT_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_STORY_ANSWER_LENGTH,
  MAX_STORY_NOTE_LENGTH,
  MAX_STORY_VERSIONS,
} from './limits';

const LOGIN_ID_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._-]{2,63}$/u;
const QUESTION_NUMBERS = new Set(Array.from({ length: 15 }, (_, index) => index + 1));

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function success<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function failure<T>(error: string): ValidationResult<T> {
  return { ok: false, error };
}

function normalizeRequiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readOptionalText(
  value: unknown,
  label: string,
  maxLength: number,
): ValidationResult<string | null> {
  if (value === undefined || value === null || value === '') {
    return success(null);
  }
  if (typeof value !== 'string') {
    return failure(`${label}の形式が正しくありません`);
  }

  const normalized = value.trim();
  if (!normalized) return success(null);
  if (normalized.length > maxLength) {
    return failure(`${label}は${maxLength.toLocaleString('ja-JP')}文字以内で入力してください`);
  }
  return success(normalized);
}

export interface LoginInput {
  loginId: string;
  rawLoginId: string;
  password: string;
  adminOnly: boolean;
}

export function parseLoginInput(body: Record<string, unknown>): ValidationResult<LoginInput> {
  const allowedFields = new Set(['loginId', 'password', 'adminOnly']);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return failure('リクエストの形式が正しくありません');
  }

  const rawLoginId = typeof body.loginId === 'string' ? body.loginId : '';
  const normalizedLoginId = rawLoginId.trim();
  const password = typeof body.password === 'string' ? body.password : '';

  // Login intentionally accepts legacy credentials that predate the stricter
  // account-creation limits. The request body byte limit remains the outer bound.
  if (!rawLoginId || rawLoginId.includes('\0') || !password) {
    return failure('ログインIDとパスワードを入力してください');
  }
  if (body.adminOnly !== undefined && typeof body.adminOnly !== 'boolean') {
    return failure('リクエストの形式が正しくありません');
  }

  return success({
    loginId: normalizedLoginId || rawLoginId,
    rawLoginId,
    password,
    adminOnly: body.adminOnly === true,
  });
}

export interface AccountInput {
  loginId: string;
  displayName: string;
  password: string;
}

export function parseAccountInput(body: Record<string, unknown>): ValidationResult<AccountInput> {
  const allowedFields = new Set(['loginId', 'displayName', 'password']);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return failure('リクエストの形式が正しくありません');
  }

  const loginId = normalizeRequiredString(body.loginId);
  const displayName = normalizeRequiredString(body.displayName);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!loginId || !displayName || !password) {
    return failure('ログインID、表示名、パスワードを入力してください');
  }
  if (!LOGIN_ID_PATTERN.test(loginId)) {
    return failure('ログインIDは3〜64文字の文字・数字・ピリオド・ハイフン・アンダースコアで入力してください');
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return failure(`表示名は${MAX_DISPLAY_NAME_LENGTH}文字以内で入力してください`);
  }

  const passwordError = getPasswordValidationError(password);
  if (passwordError) return failure(passwordError);

  return success({ loginId, displayName, password });
}

export interface DailyLogInput {
  date: string;
  logDate: Date;
  baseRevision: number | null;
  score: number;
  practiced: boolean;
  goodText: string | null;
  improveText: string | null;
  tomorrowText: string | null;
}

export function parseDailyLogInput(body: Record<string, unknown>): ValidationResult<DailyLogInput> {
  const allowedFields = new Set([
    'date',
    'baseRevision',
    'score',
    'practiced',
    'goodText',
    'improveText',
    'tomorrowText',
  ]);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return failure('リクエストの形式が正しくありません');
  }

  const date = typeof body.date === 'string' ? body.date : '';
  const logDate = parseDailyLogDate(date);
  if (!logDate) return failure('日付は1970年以降、今日から1年以内で入力してください');

  let baseRevision: number | null = null;
  if (body.baseRevision !== null) {
    if (
      typeof body.baseRevision !== 'number'
      || !Number.isSafeInteger(body.baseRevision)
      || body.baseRevision < 1
      || body.baseRevision > 2_147_483_646
    ) {
      return failure('更新情報が正しくありません。日誌を再読み込みしてください');
    }
    baseRevision = body.baseRevision;
  }

  if (typeof body.score !== 'number' || !Number.isInteger(body.score) || body.score < 1 || body.score > 10) {
    return failure('点数は1〜10の整数で入力してください');
  }
  if (typeof body.practiced !== 'boolean') {
    return failure('練習の有無を正しく入力してください');
  }

  const goodText = readOptionalText(body.goodText, '良かったこと', MAX_DAILY_TEXT_LENGTH);
  if (!goodText.ok) return goodText;
  const improveText = readOptionalText(body.improveText, '次に良くしたいこと', MAX_DAILY_TEXT_LENGTH);
  if (!improveText.ok) return improveText;
  const tomorrowText = readOptionalText(body.tomorrowText, '次の練習で意識すること', MAX_DAILY_TEXT_LENGTH);
  if (!tomorrowText.ok) return tomorrowText;

  return success({
    date,
    logDate,
    baseRevision,
    score: body.score,
    practiced: body.practiced,
    goodText: goodText.value,
    improveText: improveText.value,
    tomorrowText: tomorrowText.value,
  });
}

export interface StoryInput {
  baseVersion: number | null;
  answers: Array<{ questionNo: number; answerText: string }>;
  note: string | null;
}

export function parseStoryInput(body: Record<string, unknown>): ValidationResult<StoryInput> {
  const allowedFields = new Set(['baseVersion', 'answers', 'note']);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return failure('リクエストの形式が正しくありません');
  }

  const baseVersion = body.baseVersion;
  if (
    baseVersion !== null
    && (
      typeof baseVersion !== 'number'
      || !Number.isSafeInteger(baseVersion)
      || baseVersion < 1
      || baseVersion > MAX_STORY_VERSIONS
    )
  ) {
    return failure('元のバージョンが正しくありません');
  }

  if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) {
    return failure('回答データが正しくありません');
  }

  const entries = Object.entries(body.answers);
  if (entries.length > QUESTION_NUMBERS.size) {
    return failure('回答データが正しくありません');
  }

  const answers: StoryInput['answers'] = [];
  for (const [questionKey, answerValue] of entries) {
    const questionNo = Number(questionKey);
    if (
      !Number.isInteger(questionNo)
      || String(questionNo) !== questionKey
      || !QUESTION_NUMBERS.has(questionNo)
    ) {
      return failure('質問番号が正しくありません');
    }
    if (typeof answerValue !== 'string') {
      return failure(`Q${questionNo}の回答形式が正しくありません`);
    }

    const answerText = answerValue.trim();
    if (!answerText) continue;
    if (answerText.length > MAX_STORY_ANSWER_LENGTH) {
      return failure(`Q${questionNo}の回答は${MAX_STORY_ANSWER_LENGTH.toLocaleString('ja-JP')}文字以内で入力してください`);
    }
    answers.push({ questionNo, answerText });
  }

  if (answers.length === 0) {
    return failure('少なくとも1つの質問に回答してください');
  }

  const note = readOptionalText(body.note, '保存メモ', MAX_STORY_NOTE_LENGTH);
  if (!note.ok) return note;

  answers.sort((left, right) => left.questionNo - right.questionNo);
  return success({ baseVersion, answers, note: note.value });
}

export function parseBooleanInput(value: unknown): ValidationResult<boolean> {
  return typeof value === 'boolean'
    ? success(value)
    : failure('状態の指定が正しくありません');
}
