export type ReturnPathScope = 'user' | 'admin';

const RETURN_PATH_BASE = 'https://return-path.invalid';
const MAX_RETURN_PATH_LENGTH = 2_048;

function isAllowedPath(pathname: string, scope: ReturnPathScope): boolean {
    if (scope === 'admin') {
        return pathname === '/admin/users' || pathname.startsWith('/admin/users/');
    }

    return pathname === '/'
        || pathname === '/daily'
        || pathname === '/story'
        || pathname.startsWith('/story/')
        || pathname === '/timeline';
}

/**
 * Accepts only local application destinations for the requested account role.
 * This function is shared by server redirects and client navigation so a
 * crafted `next` query can never become an open redirect or cross role areas.
 */
export function sanitizeReturnPath(
    value: string | readonly string[] | null | undefined,
    scope: ReturnPathScope,
): string | null {
    if (
        typeof value !== 'string'
        || value.length === 0
        || value.length > MAX_RETURN_PATH_LENGTH
        || !value.startsWith('/')
        || value.startsWith('//')
        || value.includes('\\')
        || /[\u0000-\u001f\u007f]/.test(value)
    ) {
        return null;
    }

    try {
        const url = new URL(value, RETURN_PATH_BASE);
        if (url.origin !== RETURN_PATH_BASE || !isAllowedPath(url.pathname, scope)) return null;

        // Encoded path separators are interpreted inconsistently by proxies.
        // Reject them rather than risk a downstream normalization bypass.
        if (/%2f|%5c/i.test(url.pathname)) return null;
        return `${url.pathname}${url.search}`;
    } catch {
        return null;
    }
}

export function defaultReturnPath(scope: ReturnPathScope): string {
    return scope === 'admin' ? '/admin/users' : '/';
}

export function loginHref(
    returnPath: string | readonly string[] | null | undefined,
    scope: ReturnPathScope,
): string {
    const loginPath = scope === 'admin' ? '/admin/login' : '/login';
    const safeReturnPath = sanitizeReturnPath(returnPath, scope);
    if (!safeReturnPath || safeReturnPath === defaultReturnPath(scope)) return loginPath;
    return `${loginPath}?next=${encodeURIComponent(safeReturnPath)}`;
}

export function postLoginDestination(role: unknown, returnPath: string | null): string | null {
    if (role !== 'USER' && role !== 'ADMIN') return null;
    const scope = role === 'ADMIN' ? 'admin' : 'user';
    return sanitizeReturnPath(returnPath, scope) ?? defaultReturnPath(scope);
}
