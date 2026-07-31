import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_STORY_ANSWER_LENGTH } from './limits';
import { parseStoryReadResponse } from './story-read-response';

test('story read parser keeps answers created before the current write limit', () => {
    const historicalAnswer = '泳'.repeat(MAX_STORY_ANSWER_LENGTH + 1);
    const parsed = parseStoryReadResponse({
        user: { id: 'user-1', displayName: '選手' },
        story: {
            version: 3,
            answers: [{ questionNo: 1, answerText: historicalAnswer }],
        },
    });

    assert.ok(parsed?.story);
    assert.equal(parsed.story.answers[0]?.answerText, historicalAnswer);
});

test('story read parser ignores obsolete or duplicate questions without hiding valid answers', () => {
    const parsed = parseStoryReadResponse({
        user: { id: 'user-1', displayName: '選手' },
        story: {
            version: 1,
            answers: [
                { questionNo: 1, answerText: '現在の回答' },
                { questionNo: 1, answerText: '重複した旧回答' },
                { questionNo: 99, answerText: '廃止された質問' },
            ],
        },
    });

    assert.ok(parsed?.story);
    assert.deepEqual(parsed.story.answers, [{ questionNo: 1, answerText: '現在の回答' }]);
    assert.equal(parsed.story.legacyAnswerCount, 2);
});

test('story read parser still rejects malformed response values', () => {
    assert.equal(parseStoryReadResponse({
        user: { id: 'user-1', displayName: '選手' },
        story: { version: 1, answers: [{ questionNo: 1, answerText: 123 }] },
    }), null);
});
