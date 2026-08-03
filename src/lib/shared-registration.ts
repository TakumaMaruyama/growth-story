import { createHash, timingSafeEqual } from 'node:crypto';

const SHARED_REGISTRATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isSharedRegistrationToken(value: unknown): value is string {
    return typeof value === 'string' && SHARED_REGISTRATION_TOKEN_PATTERN.test(value);
}

export function normalizeAthleteRegistrationIdentity(value: string): string {
    return value
        .normalize('NFKC')
        .replace(/\s+/gu, ' ')
        .trim()
        .toLocaleLowerCase('ja-JP');
}

export function getConfiguredSharedRegistrationToken(): string | null {
    const token = process.env.REGISTRATION_ACCESS_TOKEN?.trim();
    return isSharedRegistrationToken(token) ? token : null;
}

export function isSharedRegistrationAccessAllowed(
    candidate: unknown,
    configuredToken = getConfiguredSharedRegistrationToken(),
): boolean {
    if (!isSharedRegistrationToken(candidate) || !configuredToken) return false;

    const candidateHash = createHash('sha256').update(candidate).digest();
    const configuredHash = createHash('sha256').update(configuredToken).digest();
    return timingSafeEqual(candidateHash, configuredHash);
}
