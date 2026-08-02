import assert from 'node:assert/strict';
import test from 'node:test';
import {
    generateRegistrationInviteToken,
    hashRegistrationInviteToken,
    isRegistrationInviteToken,
    isRegistrationInviteUsable,
} from './registration-invite';

test('registration invite tokens are unique 256-bit base64url values', () => {
    const tokens = Array.from({ length: 100 }, () => generateRegistrationInviteToken());

    assert.equal(new Set(tokens).size, tokens.length);
    for (const token of tokens) {
        assert.equal(isRegistrationInviteToken(token), true);
        assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    }
});

test('registration invite tokens reject malformed and padded values', () => {
    assert.equal(isRegistrationInviteToken('A'.repeat(43)), true);
    assert.equal(isRegistrationInviteToken('A'.repeat(42)), false);
    assert.equal(isRegistrationInviteToken('A'.repeat(44)), false);
    assert.equal(isRegistrationInviteToken(`${'A'.repeat(42)}=`), false);
    assert.equal(isRegistrationInviteToken(`${'A'.repeat(42)}+`), false);
    assert.equal(isRegistrationInviteToken('Ａ'.repeat(43)), false);
    assert.equal(isRegistrationInviteToken(null), false);
    assert.equal(isRegistrationInviteToken(undefined), false);
});

test('registration invite tokens are stored only as deterministic SHA-256 hashes', () => {
    const token = generateRegistrationInviteToken();
    const hash = hashRegistrationInviteToken(token);

    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, token);
    assert.equal(hashRegistrationInviteToken(token), hash);
    assert.notEqual(hashRegistrationInviteToken(generateRegistrationInviteToken()), hash);
});

test('registration invites are usable only before expiry and before use or revocation', () => {
    const now = new Date('2026-08-03T00:00:00.000Z');
    const available = {
        expiresAt: new Date('2026-08-03T00:00:00.001Z'),
        usedAt: null,
        revokedAt: null,
    };

    assert.equal(isRegistrationInviteUsable(available, now), true);
    assert.equal(isRegistrationInviteUsable({
        ...available,
        expiresAt: new Date('2026-08-03T00:00:00.000Z'),
    }, now), false);
    assert.equal(isRegistrationInviteUsable({
        ...available,
        expiresAt: new Date('2026-08-02T23:59:59.999Z'),
    }, now), false);
    assert.equal(isRegistrationInviteUsable({
        ...available,
        usedAt: new Date('2026-08-02T00:00:00.000Z'),
    }, now), false);
    assert.equal(isRegistrationInviteUsable({
        ...available,
        revokedAt: new Date('2026-08-02T00:00:00.000Z'),
    }, now), false);
});
