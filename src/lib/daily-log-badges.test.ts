import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DAILY_LOG_BADGE_MILESTONES,
    getDailyLogBadgeProgress,
    getNewlyEarnedDailyLogBadges,
    isDailyLogBadgeMilestone,
} from './daily-log-badges';

test('daily-log badge milestones remain the agreed cumulative thresholds', () => {
    assert.deepEqual(DAILY_LOG_BADGE_MILESTONES, [1, 3, 7, 10, 25, 50, 100, 200]);
    assert.equal(Object.isFrozen(DAILY_LOG_BADGE_MILESTONES), true);
});

test('badge progress starts before the first record', () => {
    assert.deepEqual(getDailyLogBadgeProgress(0), {
        recordCount: 0,
        earnedMilestones: [],
        latestMilestone: null,
        nextMilestone: 1,
        remaining: 1,
        progress: 0,
    });
});

test('badge progress advances between milestones and resets at each earned milestone', () => {
    assert.deepEqual(getDailyLogBadgeProgress(1), {
        recordCount: 1,
        earnedMilestones: [1],
        latestMilestone: 1,
        nextMilestone: 3,
        remaining: 2,
        progress: 0,
    });
    assert.deepEqual(getDailyLogBadgeProgress(2), {
        recordCount: 2,
        earnedMilestones: [1],
        latestMilestone: 1,
        nextMilestone: 3,
        remaining: 1,
        progress: 0.5,
    });
    assert.deepEqual(getDailyLogBadgeProgress(3), {
        recordCount: 3,
        earnedMilestones: [1, 3],
        latestMilestone: 3,
        nextMilestone: 7,
        remaining: 4,
        progress: 0,
    });
    assert.equal(getDailyLogBadgeProgress(5).progress, 0.5);
});

test('badge progress handles the requested 7, 10 and 200 record boundaries', () => {
    const seven = getDailyLogBadgeProgress(7);
    assert.equal(seven.latestMilestone, 7);
    assert.equal(seven.nextMilestone, 10);
    assert.equal(seven.remaining, 3);
    assert.equal(seven.progress, 0);

    const ten = getDailyLogBadgeProgress(10);
    assert.equal(ten.latestMilestone, 10);
    assert.equal(ten.nextMilestone, 25);
    assert.equal(ten.remaining, 15);
    assert.equal(ten.progress, 0);

    assert.deepEqual(getDailyLogBadgeProgress(200), {
        recordCount: 200,
        earnedMilestones: [1, 3, 7, 10, 25, 50, 100, 200],
        latestMilestone: 200,
        nextMilestone: null,
        remaining: null,
        progress: 1,
    });
});

test('counts beyond the final milestone remain complete', () => {
    const progress = getDailyLogBadgeProgress(365);
    assert.equal(progress.latestMilestone, 200);
    assert.equal(progress.nextMilestone, null);
    assert.equal(progress.remaining, null);
    assert.equal(progress.progress, 1);
});

test('milestone detection accepts only exact milestone counts', () => {
    for (const milestone of DAILY_LOG_BADGE_MILESTONES) {
        assert.equal(isDailyLogBadgeMilestone(milestone), true, String(milestone));
    }
    for (const count of [0, 2, 4, 6, 8, 9, 11, 24, 26, 199, 201]) {
        assert.equal(isDailyLogBadgeMilestone(count), false, String(count));
    }
});

test('newly earned badges include every crossed threshold and ignore edits or decreases', () => {
    assert.deepEqual(getNewlyEarnedDailyLogBadges(0, 1), [1]);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(1, 3), [3]);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(6, 10), [7, 10]);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(10, 10), []);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(10, 9), []);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(200, 201), []);
});

test('badge helpers reject impossible record counts', () => {
    for (const count of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(() => getDailyLogBadgeProgress(count), RangeError);
    }
    assert.throws(() => getNewlyEarnedDailyLogBadges(-1, 1), RangeError);
    assert.throws(() => getNewlyEarnedDailyLogBadges(0, 1.5), RangeError);
});
