import assert from 'node:assert/strict';
import test from 'node:test';
import { STORY_QUESTIONS } from './story-questions';
import {
    countAnsweredStoryQuestions,
    parseStoryQuestionParam,
    resolveInitialStoryQuestionNo,
    rotatingStoryQuestionNo,
} from './story-question-navigation';

test('story question parameter accepts only canonical question numbers', () => {
    assert.equal(parseStoryQuestionParam('1'), 1);
    assert.equal(parseStoryQuestionParam('15'), 15);
    assert.equal(parseStoryQuestionParam(null), null);
    assert.equal(parseStoryQuestionParam('0'), null);
    assert.equal(parseStoryQuestionParam('16'), null);
    assert.equal(parseStoryQuestionParam('01'), null);
    assert.equal(parseStoryQuestionParam('1.0'), null);
});

test('requested question wins, otherwise the first unanswered question is selected', () => {
    const answers = { 1: '答え', 2: '   ', 3: '答え' };

    assert.equal(resolveInitialStoryQuestionNo('3', answers), 3);
    assert.equal(resolveInitialStoryQuestionNo('invalid', answers), 2);
    assert.equal(resolveInitialStoryQuestionNo(null, answers), 2);
    assert.equal(countAnsweredStoryQuestions(answers), 2);
});

test('all answered stories rotate one question each Japan calendar day', () => {
    const answers = Object.fromEntries(STORY_QUESTIONS.map((question) => [question.no, '回答']));
    const firstDate = new Date('2026-08-01T14:59:00.000Z');
    const nextJapanDate = new Date('2026-08-01T15:01:00.000Z');
    const firstQuestion = rotatingStoryQuestionNo(firstDate);
    const nextQuestion = rotatingStoryQuestionNo(nextJapanDate);
    const firstIndex = STORY_QUESTIONS.findIndex((question) => question.no === firstQuestion);

    assert.equal(resolveInitialStoryQuestionNo(null, answers, firstDate), firstQuestion);
    assert.equal(nextQuestion, STORY_QUESTIONS[(firstIndex + 1) % STORY_QUESTIONS.length]?.no);
    assert.equal(countAnsweredStoryQuestions(answers), STORY_QUESTIONS.length);
});
