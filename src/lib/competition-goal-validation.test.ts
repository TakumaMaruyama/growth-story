import assert from 'node:assert/strict';
import test from 'node:test';
import {
    parseCompetitionGoalCreateInput,
    parseCompetitionGoalDeleteInput,
    parseCompetitionGoalUpdateInput,
} from './competition-goal-validation';
import { MAX_GOAL_DETAILS_LENGTH, MAX_GOAL_TITLE_LENGTH } from './limits';

test('goal creation validation accepts all supported goal types', () => {
    const nextMeet = parseCompetitionGoalCreateInput({
        type: 'next_meet',
        title: '県大会で自己ベストを出す',
        details: '前半を落ち着いて入る',
        targetDate: null,
    });
    assert.equal(nextMeet.ok, true);
    if (nextMeet.ok) assert.equal(nextMeet.value.type, 'NEXT_MEET');

    const annual = parseCompetitionGoalCreateInput({
        type: 'annual',
        title: '全国大会に出場する',
        targetDate: '2026-12-31',
    });
    assert.equal(annual.ok, true);

    const milestone = parseCompetitionGoalCreateInput({
        type: 'milestone',
        title: '県大会の標準記録を突破する',
        targetDate: '2027-03-31',
    });
    assert.equal(milestone.ok, true);
});

test('goal creation validation requires dates for annual and milestone goals', () => {
    assert.equal(parseCompetitionGoalCreateInput({
        type: 'annual',
        title: '年間目標',
    }).ok, false);
    assert.equal(parseCompetitionGoalCreateInput({
        type: 'milestone',
        title: '期限つき目標',
        targetDate: '2026-02-30',
    }).ok, false);
    assert.equal(parseCompetitionGoalCreateInput({
        type: 'annual',
        title: '年間目標',
        targetDate: '2026-08-01',
    }).ok, false);
});

test('goal validation rejects unknown fields, invalid types, and oversized text', () => {
    assert.equal(parseCompetitionGoalCreateInput({
        type: 'unknown',
        title: '目標',
    }).ok, false);
    assert.equal(parseCompetitionGoalCreateInput({
        type: 'next_meet',
        title: 'a'.repeat(MAX_GOAL_TITLE_LENGTH + 1),
    }).ok, false);
    assert.equal(parseCompetitionGoalCreateInput({
        type: 'next_meet',
        title: '目標',
        details: 'a'.repeat(MAX_GOAL_DETAILS_LENGTH + 1),
    }).ok, false);
    assert.equal(parseCompetitionGoalCreateInput({
        type: 'next_meet',
        title: '目標',
        userId: 'another-user',
    }).ok, false);
});

test('goal update and archive validation requires a strict CAS revision', () => {
    const update = parseCompetitionGoalUpdateInput({
        baseRevision: 3,
        title: '更新した目標',
        isActive: false,
    });
    assert.equal(update.ok, true);

    assert.equal(parseCompetitionGoalUpdateInput({ baseRevision: 3 }).ok, false);
    assert.equal(parseCompetitionGoalUpdateInput({ baseRevision: '3', title: '目標' }).ok, false);
    assert.equal(parseCompetitionGoalUpdateInput({ baseRevision: 3, isActive: 'false' }).ok, false);
    assert.equal(parseCompetitionGoalDeleteInput({ baseRevision: 1 }).ok, true);
    assert.equal(parseCompetitionGoalDeleteInput({ baseRevision: 0 }).ok, false);
    assert.equal(parseCompetitionGoalDeleteInput({ baseRevision: 1, userId: 'another-user' }).ok, false);
});
