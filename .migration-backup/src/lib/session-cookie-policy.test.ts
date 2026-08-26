import assert from 'node:assert/strict';
import test from 'node:test';
import { SESSION_COOKIE_SAME_SITE } from './session-cookie-policy';

test('session cookie allows authenticated top-level deep links', () => {
    assert.equal(SESSION_COOKIE_SAME_SITE, 'lax');
});
