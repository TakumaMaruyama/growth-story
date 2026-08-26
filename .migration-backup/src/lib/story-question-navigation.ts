import { STORY_QUESTIONS, type StoryQuestionNo } from './story-questions';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const JAPAN_TIME_ZONE = 'Asia/Tokyo';

export function isStoryQuestionAnswered(answer: string | undefined): boolean {
    return Boolean(answer?.trim());
}

export function countAnsweredStoryQuestions(answers: Record<number, string>): number {
    return STORY_QUESTIONS.filter((question) => isStoryQuestionAnswered(answers[question.no])).length;
}

export function parseStoryQuestionParam(value: string | null): StoryQuestionNo | null {
    if (!value || !/^[1-9]\d*$/.test(value)) return null;

    const questionNo = Number(value);
    return STORY_QUESTIONS.some((question) => question.no === questionNo)
        ? questionNo as StoryQuestionNo
        : null;
}

function japanCalendarDay(date: Date): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: JAPAN_TIME_ZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);

    return Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY);
}

export function rotatingStoryQuestionNo(date: Date): StoryQuestionNo {
    const questionIndex = japanCalendarDay(date) % STORY_QUESTIONS.length;
    return STORY_QUESTIONS[questionIndex]?.no ?? STORY_QUESTIONS[0].no;
}

export function resolveInitialStoryQuestionNo(
    requestedQuestion: string | null,
    answers: Record<number, string>,
    date: Date = new Date(),
): StoryQuestionNo {
    const requestedQuestionNo = parseStoryQuestionParam(requestedQuestion);
    if (requestedQuestionNo !== null) return requestedQuestionNo;

    const firstUnanswered = STORY_QUESTIONS.find(
        (question) => !isStoryQuestionAnswered(answers[question.no]),
    );
    return firstUnanswered?.no ?? rotatingStoryQuestionNo(date);
}
