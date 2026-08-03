import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
    DAILY_LOG_BADGE_DEFINITIONS,
    DAILY_LOG_BADGE_MILESTONES,
    getDailyLogBadgeDefinition,
    getDailyLogBadgeProgress,
    getDailyLogBadgeReachCounts,
    getNewlyEarnedDailyLogBadges,
    isDailyLogBadgeMilestone,
} from './daily-log-badges';

test('daily-log badge milestones culminate in the ten-year legend badge', () => {
    assert.deepEqual(DAILY_LOG_BADGE_MILESTONES, [
        1, 3, 7, 10, 25, 50, 100, 200, 365, 500,
        730, 1000, 1500, 2000, 2500, 3000, 3650,
    ]);
    assert.equal(Object.isFrozen(DAILY_LOG_BADGE_MILESTONES), true);
    assert.equal(Object.isFrozen(DAILY_LOG_BADGE_DEFINITIONS), true);
    assert.equal(DAILY_LOG_BADGE_DEFINITIONS.length, 17);
    assert.deepEqual(DAILY_LOG_BADGE_DEFINITIONS.at(-1), {
        milestone: 3650,
        name: 'レジェンド',
        color: '#111827',
        swatch: 'linear-gradient(135deg, #111827, #7c3aed, #f59e0b, #fef3c7)',
        foreground: '#ffffff',
    });
    for (const definition of DAILY_LOG_BADGE_DEFINITIONS) {
        assert.equal(getDailyLogBadgeDefinition(definition.milestone), definition);
        assert.ok(definition.name);
        assert.match(definition.color, /^#[0-9a-f]{6}$/i);
        assert.match(definition.swatch, /^linear-gradient\(/);
    }
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

test('badge progress handles early and long-term record boundaries', () => {
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

    const twoHundred = getDailyLogBadgeProgress(200);
    assert.equal(twoHundred.latestMilestone, 200);
    assert.equal(twoHundred.nextMilestone, 365);
    assert.equal(twoHundred.remaining, 165);

    const tenYears = getDailyLogBadgeProgress(3650);
    assert.equal(tenYears.latestMilestone, 3650);
    assert.equal(tenYears.nextMilestone, null);
    assert.equal(tenYears.remaining, null);
    assert.equal(tenYears.progress, 1);
});

test('counts at and beyond the final long-term milestone remain complete', () => {
    const progress = getDailyLogBadgeProgress(3650);
    assert.equal(progress.latestMilestone, 3650);
    assert.equal(progress.nextMilestone, null);
    assert.equal(progress.remaining, null);
    assert.equal(progress.progress, 1);

    const beyond = getDailyLogBadgeProgress(10000);
    assert.equal(beyond.latestMilestone, 3650);
    assert.equal(beyond.nextMilestone, null);
    assert.equal(beyond.remaining, null);
    assert.equal(beyond.progress, 1);
});

test('milestone detection accepts only exact milestone counts', () => {
    for (const milestone of DAILY_LOG_BADGE_MILESTONES) {
        assert.equal(isDailyLogBadgeMilestone(milestone), true, String(milestone));
    }
    for (const count of [0, 2, 4, 6, 8, 9, 11, 24, 26, 199, 201, 364, 366, 3649, 3651, 5000, 7300, 10000]) {
        assert.equal(isDailyLogBadgeMilestone(count), false, String(count));
    }
});

test('newly earned badges include every crossed threshold and ignore edits or decreases', () => {
    assert.deepEqual(getNewlyEarnedDailyLogBadges(0, 1), [1]);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(1, 3), [3]);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(2, 4), [3]);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(6, 10), [7, 10]);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(10, 10), []);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(10, 9), []);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(199, 365), [200, 365]);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(3000, 5000), [3650]);
    assert.deepEqual(getNewlyEarnedDailyLogBadges(3650, 10000), []);
});

test('badge reach counts include exact totals for every milestone, including zero', () => {
    const reachCounts = getDailyLogBadgeReachCounts([0, 1, 3, 10, 10, 3650]);

    assert.deepEqual(reachCounts.slice(0, 5), [
        { milestone: 1, userCount: 5 },
        { milestone: 3, userCount: 4 },
        { milestone: 7, userCount: 3 },
        { milestone: 10, userCount: 3 },
        { milestone: 25, userCount: 1 },
    ]);
    assert.deepEqual(reachCounts.at(-1), { milestone: 3650, userCount: 1 });
    assert.equal(reachCounts.length, DAILY_LOG_BADGE_MILESTONES.length);

    const empty = getDailyLogBadgeReachCounts([]);
    assert.equal(empty.every(({ userCount }) => userCount === 0), true);
});

test('badge helpers reject impossible record counts', () => {
    for (const count of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(() => getDailyLogBadgeProgress(count), RangeError);
    }
    assert.throws(() => getNewlyEarnedDailyLogBadges(-1, 1), RangeError);
    assert.throws(() => getNewlyEarnedDailyLogBadges(0, 1.5), RangeError);
    assert.throws(() => getDailyLogBadgeReachCounts([1, -1]), RangeError);
});

test('daily page keeps the color criteria available but collapsed by default', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/app/daily/page.tsx'), 'utf8');
    assert.match(source, /<details className="milestone-guide">/);
    assert.match(source, /バッジの色と達成条件を見る/);
    assert.match(source, /最高バッジ「レジェンド」を達成しました/);
    assert.match(source, /最終バッジは3,650日（10年）の「レジェンド」です/);
    assert.match(source, /DAILY_LOG_BADGE_DEFINITIONS\.map/);
    assert.match(source, /全ユーザーで.*人が到達/);
    assert.doesNotMatch(source, /<details className="milestone-guide"\s+open/);
});
