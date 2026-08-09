import assert from 'node:assert/strict';
import test from 'node:test';
import { getMemberLatestUpdate } from './member-latest-update';

test('returns null when a member has not saved any core records', () => {
    assert.equal(getMemberLatestUpdate('user-1', {
        dailyLog: null,
        competitionGoal: null,
        storyVersion: null,
    }), null);
});

test('uses the save time rather than the log date when an older daily log was edited', () => {
    const latest = getMemberLatestUpdate('user/1', {
        dailyLog: {
            logDate: new Date('2026-07-20T00:00:00.000Z'),
            updatedAt: new Date('2026-08-10T03:04:00.000Z'),
        },
        competitionGoal: {
            id: 'goal-1',
            type: 'NEXT_MEET',
            updatedAt: new Date('2026-08-09T03:04:00.000Z'),
        },
        storyVersion: {
            id: 'story-1',
            version: 2,
            createdAt: new Date('2026-08-08T03:04:00.000Z'),
        },
    });

    assert.deepEqual(latest, {
        kind: 'daily',
        updatedAt: new Date('2026-08-10T03:04:00.000Z'),
        itemLabel: '練習日誌（2026年7月20日）',
        href: '/admin/users/user%2F1/daily/2026-07-20',
    });
});

test('links a latest goal and story to the exact admin record', () => {
    const goal = getMemberLatestUpdate('user-1', {
        dailyLog: null,
        competitionGoal: {
            id: 'goal 1',
            type: 'MILESTONE',
            updatedAt: new Date('2026-08-10T00:00:00.000Z'),
        },
        storyVersion: {
            id: 'story 1',
            version: 3,
            createdAt: new Date('2026-08-09T00:00:00.000Z'),
        },
    });
    assert.equal(goal?.itemLabel, '大会目標（出場目標）');
    assert.equal(goal?.href, '/admin/users/user-1/goals#goal-goal%201');

    const story = getMemberLatestUpdate('user-1', {
        dailyLog: null,
        competitionGoal: null,
        storyVersion: {
            id: 'story 1',
            version: 3,
            createdAt: new Date('2026-08-11T00:00:00.000Z'),
        },
    });
    assert.equal(story?.itemLabel, '競泳物語（Ver.3）');
    assert.equal(story?.href, '/admin/users/user-1/story/story%201');
});
