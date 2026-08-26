import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getPasswordHashRounds,
    hashPassword,
    passwordHashNeedsUpgrade,
    verifyPassword,
    verifyPasswordWithTimingPadding,
} from './password';

const LEGACY_COST_10_HASH = '$2b$10$8DV33TniVs1tV5octwGlWeJjGdFMr97ASVu3MkBw0W.1aDE/Gl3X2';

test('password hashing uses bcrypt cost 12 and verifies safely', async () => {
    const password = 'safe-pass-2026';
    const hash = await hashPassword(password);

    assert.match(hash, /^\$2[aby]\$12\$/);
    assert.equal(getPasswordHashRounds(hash), 12);
    assert.equal(getPasswordHashRounds('not-a-bcrypt-hash'), null);
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword('wrong-password', hash), false);

    const currentCheck = await verifyPasswordWithTimingPadding(password, hash);
    assert.equal(currentCheck.isValid, true);
    assert.deepEqual([currentCheck.rounds, currentCheck.paddingRounds].sort(), [10, 12]);
    assert.equal(passwordHashNeedsUpgrade(hash), false);

    const legacyCheck = await verifyPasswordWithTimingPadding('dummy-password-value', LEGACY_COST_10_HASH);
    assert.equal(legacyCheck.isValid, true);
    assert.deepEqual([legacyCheck.rounds, legacyCheck.paddingRounds].sort(), [10, 12]);
    assert.equal(passwordHashNeedsUpgrade(LEGACY_COST_10_HASH), true);

    const missingAccountCheck = await verifyPasswordWithTimingPadding(password);
    assert.equal(missingAccountCheck.isValid, false);
    assert.deepEqual([missingAccountCheck.rounds, missingAccountCheck.paddingRounds].sort(), [10, 12]);
});
