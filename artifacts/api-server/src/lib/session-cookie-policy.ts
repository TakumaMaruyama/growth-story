/**
 * Lax preserves authenticated top-level deep links from email/messaging apps.
 * State-changing routes separately enforce same-origin requests.
 */
export const SESSION_COOKIE_SAME_SITE = 'lax' as const;
