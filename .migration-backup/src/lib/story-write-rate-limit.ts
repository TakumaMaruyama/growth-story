import type { RateLimitRule } from './rate-limit';

const STORY_WRITE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Story writes are intentionally keyed by authenticated user, not source IP.
 * A shared school or team network therefore cannot make unrelated athletes
 * consume one another's allowance.
 */
export function storyWriteRateLimitRules(userId: string): RateLimitRule[] {
    return [
        {
            namespace: 'story-write-user',
            identifier: userId,
            maxAttempts: 60,
            windowMs: STORY_WRITE_WINDOW_MS,
        },
        {
            namespace: 'story-write-global',
            identifier: 'all',
            maxAttempts: 5_000,
            windowMs: STORY_WRITE_WINDOW_MS,
        },
    ];
}
