export interface UserNameFields {
    displayName: string;
    familyName?: string | null;
    givenName?: string | null;
}

export interface AdminTargetUserNameFields extends UserNameFields {
    id: string;
}

function normalizeStoredNamePart(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized || null;
}

export function hasStructuredRealName(user: UserNameFields): boolean {
    return Boolean(
        normalizeStoredNamePart(user.familyName)
        && normalizeStoredNamePart(user.givenName),
    );
}

/** Name shown to the athlete. New registrations use their real given name. */
export function getUserDisplayName(user: UserNameFields): string {
    return normalizeStoredNamePart(user.givenName)
        ?? normalizeStoredNamePart(user.displayName)
        ?? 'ユーザー';
}

/** Full real name for administrator-only identity checks, with a legacy fallback. */
export function getUserFullName(user: UserNameFields): string {
    const familyName = normalizeStoredNamePart(user.familyName);
    const givenName = normalizeStoredNamePart(user.givenName);
    if (familyName && givenName) return `${familyName} ${givenName}`;
    return normalizeStoredNamePart(user.displayName) ?? 'ユーザー';
}

/** Admin-only API shape that preserves the existing target user identifier. */
export function serializeAdminTargetUser(user: AdminTargetUserNameFields): {
    id: string;
    displayName: string;
    fullName: string;
} {
    return {
        id: user.id,
        displayName: user.displayName,
        fullName: getUserFullName(user),
    };
}
