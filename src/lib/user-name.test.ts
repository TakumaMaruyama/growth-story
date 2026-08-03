import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getUserDisplayName,
    getUserFullName,
    hasStructuredRealName,
    serializeAdminTargetUser,
} from './user-name';

test('new registrations show the given name to the athlete and full name to administrators', () => {
    const user = {
        displayName: '太郎',
        familyName: '山田',
        givenName: '太郎',
    };

    assert.equal(getUserDisplayName(user), '太郎');
    assert.equal(getUserFullName(user), '山田 太郎');
    assert.equal(hasStructuredRealName(user), true);
});

test('legacy users keep their existing display name without guessed name splitting', () => {
    const user = { displayName: 'スイマー', familyName: null, givenName: null };

    assert.equal(getUserDisplayName(user), 'スイマー');
    assert.equal(getUserFullName(user), 'スイマー');
    assert.equal(hasStructuredRealName(user), false);
});

test('incomplete stored name pairs safely fall back to the legacy display name', () => {
    assert.equal(getUserFullName({
        displayName: '既存名',
        familyName: '山田',
        givenName: null,
    }), '既存名');
    assert.equal(getUserDisplayName({
        displayName: '既存名',
        familyName: null,
        givenName: '   ',
    }), '既存名');
});

test('admin target-user responses keep the existing id and add only the derived full name', () => {
    assert.deepEqual(serializeAdminTargetUser({
        id: 'user-123',
        displayName: '太郎',
        familyName: '山田',
        givenName: '太郎',
    }), {
        id: 'user-123',
        displayName: '太郎',
        fullName: '山田 太郎',
    });
});
