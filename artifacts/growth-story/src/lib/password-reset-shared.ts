export const PASSWORD_RESET_TTL_MS = 2 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_VALID_DAYS = 2;

const PASSWORD_RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isPasswordResetToken(value: unknown): value is string {
    return typeof value === 'string' && PASSWORD_RESET_TOKEN_PATTERN.test(value);
}

export function getPasswordResetExpiry(createdAt: Date): Date {
    return new Date(createdAt.getTime() + PASSWORD_RESET_TTL_MS);
}
