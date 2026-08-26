import { createHash, timingSafeEqual } from 'node:crypto';

const SHARED_REGISTRATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const FORBIDDEN_REGISTRATION_NAME_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\p{Cf}\p{Default_Ignorable_Code_Point}\p{Zl}\p{Zp}]/u;
const FORBIDDEN_STORED_NAME_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f\p{Cf}\p{Default_Ignorable_Code_Point}\p{Zl}\p{Zp}]/gu;

export function hasForbiddenRegistrationNameCharacters(value: string): boolean {
    return FORBIDDEN_REGISTRATION_NAME_CHARACTER_PATTERN.test(value);
}

export function isSharedRegistrationToken(value: unknown): value is string {
    return typeof value === 'string' && SHARED_REGISTRATION_TOKEN_PATTERN.test(value);
}

export function normalizeAthleteRegistrationIdentity(value: string): string {
    if (hasForbiddenRegistrationNameCharacters(value)) {
        throw new RangeError('Athlete names must not contain control or invisible formatting characters');
    }
    return value
        .normalize('NFKC')
        .replace(/\s+/gu, '')
        .trim()
        .toLocaleLowerCase('ja-JP');
}

/** Canonicalizes pre-existing display names without letting legacy characters break registration. */
export function normalizeStoredAthleteRegistrationIdentity(value: string): string {
    return value
        .normalize('NFKC')
        .replace(FORBIDDEN_STORED_NAME_CHARACTER_PATTERN, '')
        .replace(/\s+/gu, '')
        .trim()
        .toLocaleLowerCase('ja-JP');
}

export function normalizeAthleteRegistrationIdentityParts(
    familyName: string,
    givenName: string,
): string {
    return JSON.stringify(
        [familyName, givenName].map(normalizeAthleteRegistrationIdentity),
    );
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
