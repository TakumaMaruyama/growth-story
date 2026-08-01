import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getCompetitionGoalDisplayValues,
    getCompetitionGoalFieldMapping,
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
