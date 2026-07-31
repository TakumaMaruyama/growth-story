import assert from 'node:assert/strict';
import test from 'node:test';
import {
    parseAccountInput,
    parseBooleanInput,
    parseDailyLogInput,
    parseLoginInput,
    parseStoryInput,
} from './validation';
import { MAX_DAILY_TEXT_LENGTH, MAX_STORY_ANSWER_LENGTH } from './limits';

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

test('account validation rejects weak or bcrypt-truncated passwords', () => {
    assert.equal(parseAccountInput({ loginId: 'user_01', displayName: '選手', password: 'short' }).ok, false);
    assert.equal(parseAccountInput({ loginId: 'user_01', displayName: '選手', password: 'あ'.repeat(25) }).ok, false);
    assert.equal(parseAccountInput({
        loginId: 'user_01',
        displayName: '選手',
        password: 'safe-pass-2026',
        role: 'ADMIN',
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

test('daily log validation requires strict dates, integer scores, booleans and bounded text', () => {
    const valid = parseDailyLogInput({
        date: '2026-08-01',
        baseRevision: null,
        score: 8,
        practiced: true,
        goodText: '良い練習だった',
        improveText: '',
        tomorrowText: null,
    });
    assert.equal(valid.ok, true);

    assert.equal(parseDailyLogInput({ date: '2026-02-30', baseRevision: null, score: 8, practiced: true }).ok, false);
    assert.equal(parseDailyLogInput({ date: '2026-08-01', baseRevision: null, score: '8', practiced: true }).ok, false);
    assert.equal(parseDailyLogInput({ date: '2026-08-01', baseRevision: null, score: 8.5, practiced: true }).ok, false);
    assert.equal(parseDailyLogInput({ date: '1969-12-31', baseRevision: null, score: 8, practiced: true }).ok, false);
    assert.equal(parseDailyLogInput({ date: '2026-08-01', baseRevision: 'invalid', score: 8, practiced: true }).ok, false);
    assert.equal(parseDailyLogInput({
        date: '2026-08-01',
        baseRevision: null,
        score: 8,
        practiced: true,
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
