import assert from 'node:assert/strict';
import test from 'node:test';
import { competitionGoalWriteRateLimitRules } from './competition-goal-rate-limit';

test('competition goal write limit is bounded and isolated per authenticated user', () => {
    const first = competitionGoalWriteRateLimitRules('user-a');
    const second = competitionGoalWriteRateLimitRules('user-b');

    assert.equal(first.length, 1);
    assert.equal(first[0]?.identifier, 'user-a');
    assert.equal(second[0]?.identifier, 'user-b');
    assert.equal(first[0]?.maxAttempts, 120);
    assert.equal(first[0]?.windowMs, 60 * 60 * 1000);
});
