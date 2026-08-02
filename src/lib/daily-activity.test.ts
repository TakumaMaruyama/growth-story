import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
    dailyActivityFromPracticed,
    getDailyActivityLabel,
    isDailyActivityType,
    isPracticedActivity,
} from './daily-activity';

test('daily activity types have stable labels and legacy mappings', () => {
    assert.equal(getDailyActivityLabel('PRACTICE'), '練習');
    assert.equal(getDailyActivityLabel('COMPETITION'), '大会');
    assert.equal(getDailyActivityLabel('REST'), 'お休み');

    assert.equal(dailyActivityFromPracticed(true), 'PRACTICE');
    assert.equal(dailyActivityFromPracticed(false), 'REST');
    assert.equal(isPracticedActivity('PRACTICE'), true);
    assert.equal(isPracticedActivity('COMPETITION'), true);
    assert.equal(isPracticedActivity('REST'), false);

    assert.equal(isDailyActivityType('COMPETITION'), true);
    assert.equal(isDailyActivityType('MEET'), false);
});

test('daily log UI offers practice, competition and rest in that order', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/app/daily/page.tsx'), 'utf8');
    const options = source.slice(
        source.indexOf('const ACTIVITY_OPTIONS'),
        source.indexOf('const PROMPT_DEFINITIONS'),
    );
    const positions = ['PRACTICE', 'COMPETITION', 'REST'].map((value) => options.indexOf(value));

    assert.equal(positions.every((position) => position >= 0), true);
    assert.equal(positions[0]! < positions[1]! && positions[1]! < positions[2]!, true);
    assert.match(options, /label: '大会'/);
});

test('migration backfills legacy records and preserves the compatibility column', async () => {
    const migration = await readFile(
        path.join(
            process.cwd(),
            'prisma/migrations/20260802000000_daily_activity_type/migration.sql',
        ),
        'utf8',
    );

    assert.match(migration, /WHEN "practiced" THEN 'PRACTICE'/);
    assert.match(migration, /ELSE 'REST'/);
    assert.match(migration, /daily_logs_sync_activity_type_from_practiced/);
    assert.match(migration, /daily_logs_activity_practiced_check/);
    assert.doesNotMatch(migration, /DROP COLUMN\s+"practiced"/i);
});
