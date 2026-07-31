import assert from 'node:assert/strict';
import test from 'node:test';
import { loginHref, postLoginDestination, sanitizeReturnPath } from './return-path';

test('return paths preserve valid deep links and query strings', () => {
    assert.equal(
        sanitizeReturnPath('/daily?date=2026-08-01', 'user'),
        '/daily?date=2026-08-01',
    );
    assert.equal(
        sanitizeReturnPath('/story/history/version-1', 'user'),
        '/story/history/version-1',
    );
    assert.equal(
        sanitizeReturnPath('/admin/users/user-1/daily?from=2026-01-01', 'admin'),
        '/admin/users/user-1/daily?from=2026-01-01',
    );
});

test('return paths reject external, ambiguous and cross-role destinations', () => {
    const rejectedUserPaths = [
        'https://example.com/story',
        '//example.com/story',
        '/\\example.com/story',
        '/%2f%2fexample.com/story',
        '/story/%5cexample',
        '/admin/users',
        '/api/story',
        '/login',
        ['/story'],
    ] as const;
    for (const value of rejectedUserPaths) {
        assert.equal(sanitizeReturnPath(value, 'user'), null);
    }

    assert.equal(sanitizeReturnPath('/story', 'admin'), null);
    assert.equal(sanitizeReturnPath('/admin/users', 'user'), null);
});

test('login href encodes only sanitized non-default destinations', () => {
    assert.equal(loginHref('/daily?date=2026-08-01', 'user'), '/login?next=%2Fdaily%3Fdate%3D2026-08-01');
    assert.equal(loginHref('https://example.com', 'user'), '/login');
    assert.equal(loginHref('/', 'user'), '/login');
    assert.equal(loginHref('/admin/users/user-1', 'admin'), '/admin/login?next=%2Fadmin%2Fusers%2Fuser-1');
});

test('post-login destination is revalidated against the authenticated role', () => {
    assert.equal(postLoginDestination('USER', '/daily?date=2026-08-01'), '/daily?date=2026-08-01');
    assert.equal(postLoginDestination('USER', '/admin/users/user-1'), '/');
    assert.equal(postLoginDestination('ADMIN', '/story'), '/admin/users');
    assert.equal(postLoginDestination('ADMIN', '/admin/users/user-1'), '/admin/users/user-1');
    assert.equal(postLoginDestination('unexpected', '/daily'), null);
});
