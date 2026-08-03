import assert from 'node:assert/strict';
import test from 'node:test';
import {
    parseAccountInput,
    parseBooleanInput,
    parseDailyLogInput,
    parseLoginInput,
    parseSharedRegistrationInput,
    parseStoryInput,
} from './validation';
import {
    MAX_DAILY_TEXT_LENGTH,
    MAX_DISPLAY_NAME_LENGTH,
    MAX_GUARDIAN_NAME_LENGTH,
    MAX_GUARDIAN_RELATIONSHIP_LENGTH,
    MAX_STORY_ANSWER_LENGTH,
    MIN_ADMIN_PASSWORD_LENGTH,
} from './limits';

const VALID_ACCESS_TOKEN = 'A'.repeat(43);

test('account validation accepts a strong, well-formed account', () => {
    const result = parseAccountInput({
        loginId: 'swimmer_01',
        displayName: 'スイマー',
        password: 'safe-pass-2026',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.value.loginId, 'swimmer_01');
    }
});

test('account validation accepts an eight-character alphanumeric password', () => {
    const result = parseAccountInput({
        loginId: 'user_01',
        displayName: '選手',
        password: 'abc12345',
    });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.password, 'abc12345');
});

test('account validation rejects seven-character or bcrypt-truncated passwords', () => {
    assert.equal(parseAccountInput({ loginId: 'user_01', displayName: '選手', password: 'abc1234' }).ok, false);
    assert.equal(parseAccountInput({ loginId: 'user_01', displayName: '選手', password: 'あ'.repeat(25) }).ok, false);
    assert.equal(parseAccountInput({
        loginId: 'user_01',
        displayName: '選手',
        password: 'safe-pass-2026',
        role: 'ADMIN',
    }).ok, false);
});

test('administrator bootstrap keeps the stronger ten-character minimum', () => {
    const options = { minimumPasswordLength: MIN_ADMIN_PASSWORD_LENGTH };
    assert.equal(parseAccountInput({
        loginId: 'admin_01',
        displayName: '管理者',
        password: 'abc12345',
    }, options).ok, false);
    assert.equal(parseAccountInput({
        loginId: 'admin_01',
        displayName: '管理者',
        password: 'abc1234567',
    }, options).ok, true);
});

test('shared registration requires a valid access token and explicit guardian consent', () => {
    const result = parseSharedRegistrationInput({
        accessToken: VALID_ACCESS_TOKEN,
        athleteName: ' 選手 一郎 ',
        loginId: ' invited_swimmer ',
        password: 'safe-pass-2026',
        guardianName: ' 保護者 太郎 ',
        guardianRelationship: ' 父 ',
        guardianConsent: true,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
        assert.deepEqual(result.value, {
            accessToken: VALID_ACCESS_TOKEN,
            athleteName: '選手 一郎',
            loginId: 'invited_swimmer',
            password: 'safe-pass-2026',
            guardianName: '保護者 太郎',
            guardianRelationship: '父',
        });
    }

    const otherwiseValid = {
        accessToken: VALID_ACCESS_TOKEN,
        athleteName: '選手 一郎',
        loginId: 'invited_swimmer',
        password: 'safe-pass-2026',
        guardianName: '保護者 太郎',
        guardianRelationship: '父',
    };
    assert.equal(parseSharedRegistrationInput(otherwiseValid).ok, false);
    assert.equal(parseSharedRegistrationInput({ ...otherwiseValid, guardianConsent: false }).ok, false);
    assert.equal(parseSharedRegistrationInput({ ...otherwiseValid, guardianConsent: 'true' }).ok, false);
    assert.equal(parseSharedRegistrationInput({ ...otherwiseValid, accessToken: '' }).ok, false);
    assert.equal(parseSharedRegistrationInput({ ...otherwiseValid, accessToken: 'A'.repeat(42) }).ok, false);
    assert.equal(parseSharedRegistrationInput({ ...otherwiseValid, accessToken: `${'A'.repeat(42)}=` }).ok, false);
});

test('shared registration rejects account overrides and oversized details', () => {
    const valid = {
        accessToken: VALID_ACCESS_TOKEN,
        athleteName: '選手 一郎',
        loginId: 'invited_swimmer',
        password: 'safe-pass-2026',
        guardianName: '保護者 太郎',
        guardianRelationship: '父',
        guardianConsent: true,
    };

    assert.equal(parseSharedRegistrationInput({ ...valid, displayName: '別の選手名' }).ok, false);
    assert.equal(parseSharedRegistrationInput({ ...valid, role: 'ADMIN' }).ok, false);
    assert.equal(parseSharedRegistrationInput({ ...valid, isActive: false }).ok, false);
    assert.equal(parseSharedRegistrationInput({ ...valid, membershipStatus: 'WITHDRAWN' }).ok, false);
    assert.equal(parseSharedRegistrationInput({ ...valid, noticeVersion: 'old' }).ok, false);
    assert.equal(parseSharedRegistrationInput({ ...valid, loginId: 'x' }).ok, false);
    assert.equal(parseSharedRegistrationInput({ ...valid, password: 'short' }).ok, false);
    assert.equal(parseSharedRegistrationInput({
        ...valid,
        athleteName: '泳'.repeat(MAX_DISPLAY_NAME_LENGTH + 1),
    }).ok, false);
    assert.equal(parseSharedRegistrationInput({
        ...valid,
        guardianName: '保'.repeat(MAX_GUARDIAN_NAME_LENGTH + 1),
    }).ok, false);
    assert.equal(parseSharedRegistrationInput({
        ...valid,
        guardianRelationship: '保'.repeat(MAX_GUARDIAN_RELATIONSHIP_LENGTH + 1),
    }).ok, false);
});

test('login validation preserves access for credentials created before current limits', () => {
    const result = parseLoginInput({
        loginId: `legacy_${'x'.repeat(100)}`,
        password: 'あ'.repeat(25),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.equal(result.value.loginId, `legacy_${'x'.repeat(100)}`);
        assert.equal(result.value.rawLoginId, `legacy_${'x'.repeat(100)}`);
    }

    const spaced = parseLoginInput({ loginId: ' legacy_admin ', password: 'safe-pass-2026' });
    assert.equal(spaced.ok, true);
    if (spaced.ok) {
        assert.equal(spaced.value.loginId, 'legacy_admin');
        assert.equal(spaced.value.rawLoginId, ' legacy_admin ');
    }
});

test('daily log validation requires strict dates, integer scores, activity types and bounded text', () => {
    const valid = parseDailyLogInput({
        date: '2026-08-01',
        baseRevision: null,
        score: 8,
        activityType: 'COMPETITION',
        goodText: '良い練習だった',
        improveText: '',
        tomorrowText: null,
    });
    assert.equal(valid.ok, true);
    if (valid.ok) assert.equal(valid.value.activityType, 'COMPETITION');

    const legacy = parseDailyLogInput({
        date: '2026-08-01',
        baseRevision: null,
        score: 8,
        practiced: true,
    });
    assert.equal(legacy.ok, true);
    if (legacy.ok) assert.equal(legacy.value.activityType, 'PRACTICE');

    assert.equal(parseDailyLogInput({ date: '2026-02-30', baseRevision: null, score: 8, practiced: true }).ok, false);
    assert.equal(parseDailyLogInput({ date: '2026-08-01', baseRevision: null, score: '8', practiced: true }).ok, false);
    assert.equal(parseDailyLogInput({ date: '2026-08-01', baseRevision: null, score: 8.5, practiced: true }).ok, false);
    assert.equal(parseDailyLogInput({ date: '1969-12-31', baseRevision: null, score: 8, practiced: true }).ok, false);
    assert.equal(parseDailyLogInput({ date: '2026-08-01', baseRevision: 'invalid', score: 8, practiced: true }).ok, false);
    assert.equal(parseDailyLogInput({ date: '2026-08-01', baseRevision: null, score: 8, activityType: 'MEET' }).ok, false);
    assert.equal(parseDailyLogInput({ date: '2026-08-01', baseRevision: null, score: 8 }).ok, false);
    assert.equal(parseDailyLogInput({
        date: '2026-08-01',
        baseRevision: null,
        score: 8,
        activityType: 'COMPETITION',
        practiced: false,
    }).ok, false);
    assert.equal(parseDailyLogInput({
        date: '2026-08-01',
        baseRevision: null,
        score: 8,
        activityType: 'PRACTICE',
        goodText: 'a'.repeat(MAX_DAILY_TEXT_LENGTH + 1),
    }).ok, false);
});

test('story validation accepts only questions 1 through 15 and bounded strings', () => {
    const valid = parseStoryInput({
        baseVersion: null,
        answers: { 1: '始めたきっかけ', 15: 'ありがとう' },
        note: '更新',
    });
    assert.equal(valid.ok, true);

    assert.equal(parseStoryInput({ baseVersion: null, answers: { 0: 'hidden' } }).ok, false);
    assert.equal(parseStoryInput({ baseVersion: null, answers: { 16: 'hidden' } }).ok, false);
    assert.equal(parseStoryInput({ baseVersion: null, answers: { '01': 'hidden' } }).ok, false);
    assert.equal(parseStoryInput({ baseVersion: null, answers: { 1: '' } }).ok, false);
    assert.equal(parseStoryInput({ baseVersion: null, answers: { 1: 'a'.repeat(MAX_STORY_ANSWER_LENGTH + 1) } }).ok, false);
    assert.equal(parseStoryInput({ answers: { 1: 'missing base version' } }).ok, false);
    assert.equal(parseStoryInput({ baseVersion: 0, answers: { 1: 'invalid base version' } }).ok, false);
    assert.equal(parseStoryInput({ baseVersion: 1.5, answers: { 1: 'invalid base version' } }).ok, false);
});

test('boolean validation does not coerce strings or numbers', () => {
    assert.equal(parseBooleanInput(true).ok, true);
    assert.equal(parseBooleanInput('true').ok, false);
    assert.equal(parseBooleanInput(1).ok, false);
});
