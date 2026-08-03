import { getPasswordValidationError } from './password';
import { isPasswordResetToken } from './password-reset-shared';
import type { ValidationResult } from './validation';

export interface PasswordResetInput {
    token: string;
    password: string;
}

export function parsePasswordResetInput(
    body: Record<string, unknown>,
): ValidationResult<PasswordResetInput> {
    const allowedFields = new Set(['token', 'password']);
    if (Object.keys(body).some((key) => !allowedFields.has(key))) {
        return { ok: false, error: 'リクエストの形式が正しくありません' };
    }

    if (!isPasswordResetToken(body.token)) {
        return {
            ok: false,
            error: 'この再設定URLは無効か、有効期限が切れています。管理者へ新しいURLを依頼してください',
        };
    }
    const password = typeof body.password === 'string' ? body.password : '';
    const passwordError = getPasswordValidationError(password);
    if (passwordError) return { ok: false, error: passwordError };

    return { ok: true, value: { token: body.token, password } };
}
