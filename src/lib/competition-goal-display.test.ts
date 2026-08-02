import assert from 'node:assert/strict';
import test from 'node:test';
import {
    findNextMeetGoalId,
    getCompetitionGoalDisplayValues,
    getCompetitionGoalFieldMapping,
    isCompetitionGoalElapsed,
    sortCompetitionGoalsForDisplay,
} from './competition-goal-display';

test('next-meet and annual goals use details for the meet name and title for the goal', () => {
    for (const type of ['next_meet', 'annual', 'NEXT_MEET', 'ANNUAL'] as const) {
        assert.deepEqual(getCompetitionGoalFieldMapping(type), {
            meetNameField: 'details',
            goalTextField: 'title',
        });
        assert.deepEqual(getCompetitionGoalDisplayValues({
            type,
            title: '自己ベストを出す',
            details: '社会人選手権',
        }), {
            meetName: '社会人選手権',
            goalText: '自己ベストを出す',
        });
    }
});

test('milestone goals use title for the meet name and details for the goal', () => {
    for (const type of ['milestone', 'MILESTONE'] as const) {
        assert.deepEqual(getCompetitionGoalFieldMapping(type), {
            meetNameField: 'title',
            goalTextField: 'details',
        });
        assert.deepEqual(getCompetitionGoalDisplayValues({
            type,
            title: '日本選手権',
            details: '標準記録を突破する',
        }), {
            meetName: '日本選手権',
            goalText: '標準記録を突破する',
        });
    }
});

test('display values normalize missing optional text', () => {
    assert.deepEqual(getCompetitionGoalDisplayValues({
        type: 'next_meet',
        title: '  楽しんで泳ぐ  ',
        details: null,
    }), {
        meetName: '',
        goalText: '楽しんで泳ぐ',
    });
});

test('display order is upcoming, undated, then recently elapsed', () => {
    const goals = [
        { id: 'past-old', targetDate: '2026-01-01', updatedAt: '2026-01-02T00:00:00Z' },
        { id: 'undated-old', targetDate: null, updatedAt: '2026-07-01T00:00:00Z' },
        { id: 'future-late', targetDate: '2026-10-01', updatedAt: '2026-07-01T00:00:00Z' },
        { id: 'past-recent', targetDate: '2026-07-31', updatedAt: '2026-08-01T00:00:00Z' },
        { id: 'future-near', targetDate: new Date('2026-08-02T00:00:00.000Z'), updatedAt: new Date(0) },
        { id: 'undated-new', targetDate: null, updatedAt: '2026-08-01T00:00:00Z' },
    ];

    assert.deepEqual(
        sortCompetitionGoalsForDisplay(goals, '2026-08-02').map((goal) => goal.id),
        ['future-near', 'future-late', 'undated-new', 'undated-old', 'past-recent', 'past-old'],
    );
});

test('next meet badge ignores undated, elapsed, and non-meet goals', () => {
    const goals = [
        { id: 'annual', type: 'ANNUAL' as const, targetDate: '2026-08-03' },
        { id: 'undated', type: 'next_meet' as const, targetDate: null },
        { id: 'past', type: 'NEXT_MEET' as const, targetDate: '2026-08-01' },
        { id: 'next', type: 'next_meet' as const, targetDate: '2026-08-05' },
        { id: 'later', type: 'NEXT_MEET' as const, targetDate: '2026-09-01' },
    ];

    assert.equal(findNextMeetGoalId(goals, '2026-08-02'), 'next');
    assert.equal(isCompetitionGoalElapsed(goals[2]!, '2026-08-02'), true);
    assert.equal(isCompetitionGoalElapsed(goals[3]!, '2026-08-02'), false);
});
