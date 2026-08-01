import type { RateLimitRule } from './rate-limit';

export function competitionGoalWriteRateLimitRules(userId: string): RateLimitRule[] {
    return [{
        namespace: 'competition-goal-write-user',
        identifier: userId,
        maxAttempts: 120,
        windowMs: 60 * 60 * 1000,
    }];
}
