import assert from 'node:assert/strict';
import test from 'node:test';
import { generateSessionToken, hashSessionToken } from './session-token';

test('session tokens are unique 256-bit base64url values', () => {
    const tokens = Array.from({ length: 100 }, () => generateSessionToken());
    assert.equal(new Set(tokens).size, tokens.length);
    for (const token of tokens) {
        assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    }
});

test('session tokens are stored as deterministic SHA-256 hashes', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, token);
    assert.equal(hashSessionToken(token), hash);
});
