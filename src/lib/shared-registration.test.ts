import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getConfiguredSharedRegistrationToken,
    isSharedRegistrationAccessAllowed,
    isSharedRegistrationToken,
    normalizeAthleteRegistrationIdentity,
} from './shared-registration';

const VALID_TOKEN = 'A'.repeat(43);

test('shared registration accepts only 256-bit base64url tokens', () => {
    assert.equal(isSharedRegistrationToken(VALID_TOKEN), true);
    assert.equal(isSharedRegistrationToken('A'.repeat(42)), false);
    assert.equal(isSharedRegistrationToken('A'.repeat(44)), false);
    assert.equal(isSharedRegistrationToken(`${'A'.repeat(42)}=`), false);
    assert.equal(isSharedRegistrationToken(`${'A'.repeat(42)}+`), false);
    assert.equal(isSharedRegistrationToken('Ａ'.repeat(43)), false);
    assert.equal(isSharedRegistrationToken(null), false);
});

test('shared registration access requires an exact configured token', () => {
    assert.equal(isSharedRegistrationAccessAllowed(VALID_TOKEN, VALID_TOKEN), true);
    assert.equal(isSharedRegistrationAccessAllowed('B'.repeat(43), VALID_TOKEN), false);
    assert.equal(isSharedRegistrationAccessAllowed('short', VALID_TOKEN), false);
    assert.equal(isSharedRegistrationAccessAllowed(VALID_TOKEN, null), false);
});

test('shared registration fails closed when unset and rotates immediately', { concurrency: false }, () => {
    const original = process.env.REGISTRATION_ACCESS_TOKEN;
    try {
        delete process.env.REGISTRATION_ACCESS_TOKEN;
        assert.equal(getConfiguredSharedRegistrationToken(), null);
        assert.equal(isSharedRegistrationAccessAllowed(VALID_TOKEN), false);

        process.env.REGISTRATION_ACCESS_TOKEN = VALID_TOKEN;
        assert.equal(getConfiguredSharedRegistrationToken(), VALID_TOKEN);
        assert.equal(isSharedRegistrationAccessAllowed(VALID_TOKEN), true);

        const rotated = 'B'.repeat(43);
        process.env.REGISTRATION_ACCESS_TOKEN = rotated;
        assert.equal(isSharedRegistrationAccessAllowed(VALID_TOKEN), false);
        assert.equal(isSharedRegistrationAccessAllowed(rotated), true);
    } finally {
        if (original === undefined) delete process.env.REGISTRATION_ACCESS_TOKEN;
        else process.env.REGISTRATION_ACCESS_TOKEN = original;
    }
});

test('athlete identity normalization catches harmless name variations', () => {
    assert.equal(
        normalizeAthleteRegistrationIdentity('  ＴＥＳＴ　選手  '),
        normalizeAthleteRegistrationIdentity('test 選手'),
    );
});
