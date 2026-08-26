import assert from 'node:assert/strict';
import test from 'node:test';
import { storyWriteRateLimitRules } from './story-write-rate-limit';

test('story write rate limit is isolated per authenticated user', () => {
    const first = storyWriteRateLimitRules('user-a');
    const second = storyWriteRateLimitRules('user-b');

    assert.deepEqual(first[0], {
        namespace: 'story-write-user',
        identifier: 'user-a',
        maxAttempts: 60,
        windowMs: 3_600_000,
    });
    assert.equal(second[0]?.identifier, 'user-b');
    assert.deepEqual(first[1], second[1]);
});
