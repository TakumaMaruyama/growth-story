import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function readSource(relativePath: string): Promise<string> {
    return readFile(path.join(process.cwd(), relativePath), 'utf8');
}

test('competition goals use one repeatable add flow for every goal type', async () => {
    const source = await readSource('src/app/goals/page.tsx');

    assert.match(source, /goals: GoalForm\[\];/);
    assert.match(source, /newGoal: GoalForm;/);
    assert.match(source, /queuedGoals: GoalForm\[\];/);
    assert.match(source, /queuedGoals: unsavedCandidates\.slice\(1\)/);
    assert.match(source, /current\.queuedGoals\[0\] \?\? emptyGoal\('next_meet'\)/);
    assert.match(source, /保存または破棄すると、次の下書きを表示します。/);
    assert.match(source, /大会ごとにいくつでも追加して、日付の近い目標から確認できます。/);
    assert.match(source, /\(\['next_meet', 'annual', 'milestone'\] as const\)\.map\(\(type\) =>/);
    assert.match(source, /next_meet: '大会'/);
    assert.match(source, /annual: '年間'/);
    assert.match(source, /milestone: '出場目標'/);
    assert.match(source, /\? \[\.\.\.current\.goals, saved\]/);
    assert.match(source, /\{filteredGoals\.map\(\(goal\) =>/);
});

test('competition goals list stays usable when many goals are active', async () => {
    const source = await readSource('src/app/goals/page.tsx');

    assert.match(source, /forms\.goals\.length >= 6/);
    assert.match(source, /aria-label="大会目標の絞り込み"/);
    assert.match(source, /\(\['all', 'next_meet', 'annual', 'milestone'\] as const\)\.map\(\(filter\) =>/);
    assert.match(source, /設定中 \{forms\.goals\.length\}件/);
    assert.match(source, /isEditing = !isReadOnly && editingKey === goal\.id/);
    assert.match(source, /\{isEditing && \(/);

    const obsoleteLimitCopy = [
        '20件まで',
        '最大20件',
        '1件まで',
        'ひとつまで',
        '一つまで',
        '次の大会目標はすでに設定されています',
        '年間目標はすでに設定されています',
    ];
    for (const copy of obsoleteLimitCopy) {
        assert.equal(source.includes(copy), false, `obsolete goal limit copy remains: ${copy}`);
    }
});

test('home shows at most three active goals with overflow and add affordances', async () => {
    const source = await readSource('src/app/page.tsx');

    assert.match(source, /const displayedCompetitionGoals = sortedCompetitionGoals\.slice\(0, 3\);/);
    assert.match(
        source,
        /const remainingGoalCount = competitionGoals\.length - displayedCompetitionGoals\.length;/,
    );
    assert.match(source, /\{displayedCompetitionGoals\.map\(\(goal\) =>/);
    assert.match(source, /href="\/goals\?add=1"[^>]*>目標を追加<\/Link>/);
    assert.match(source, /href="\/goals"[^>]*>すべて見る<\/Link>/);
    assert.match(source, /ほか\{remainingGoalCount\}件を見る/);
    assert.match(source, /goal\.id === nextMeetGoalId/);
    assert.match(source, />次の大会<\/span>/);
});

test('record links can focus active and archived goals without opening edit mode', async () => {
    const source = await readSource('src/app/goals/page.tsx');

    assert.match(source, /new URLSearchParams\(window\.location\.search\)/);
    assert.match(source, /query\.get\('focus'\)/);
    assert.match(source, /archivedDetailsRef\.current\.open = true/);
    assert.match(source, /document\.getElementById\(`goal-card-\$\{focusId\}`\)/);
    assert.match(source, /target\?\.focus\(\{ preventScroll: true \}\)/);
    assert.equal(source.includes('setEditingKey(focusId)'), false);
});
