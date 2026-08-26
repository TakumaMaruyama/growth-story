import { STORY_QUESTIONS } from './story-questions';

export interface StoryReadResponse {
    user: {
        id: string;
        displayName: string;
        membershipStatus: 'ACTIVE' | 'WITHDRAWN';
    };
    story: {
        version: number;
        answers: Array<{ questionNo: number; answerText: string }>;
        legacyAnswerCount: number;
    } | null;
}

const QUESTION_NUMBERS = new Set<number>(STORY_QUESTIONS.map((question) => question.no));

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoryVersion(value: unknown): value is number {
    return typeof value === 'number'
        && Number.isSafeInteger(value)
        && value >= 1;
}

/**
 * Parses story read responses without applying today's write limits.
 *
 * Historical answers can be longer than the current 4,000-character write
 * limit. They must remain readable/editable so the user can shorten them and
 * create a valid new version instead of being locked out of the editor.
 */
export function parseStoryReadResponse(value: unknown): StoryReadResponse | null {
    if (!isRecord(value) || !isRecord(value.user)) return null;
    if (
        typeof value.user.id !== 'string'
        || !value.user.id
        || typeof value.user.displayName !== 'string'
        || !value.user.displayName
        || (value.user.membershipStatus !== 'ACTIVE' && value.user.membershipStatus !== 'WITHDRAWN')
    ) {
        return null;
    }

    if (value.story === null) {
        return {
            user: {
                id: value.user.id,
                displayName: value.user.displayName,
                membershipStatus: value.user.membershipStatus,
            },
            story: null,
        };
    }
    if (!isRecord(value.story) || !isStoryVersion(value.story.version) || !Array.isArray(value.story.answers)) {
        return null;
    }

    const seenQuestions = new Set<number>();
    const answers: Array<{ questionNo: number; answerText: string }> = [];
    let legacyAnswerCount = 0;
    for (const answer of value.story.answers) {
        if (
            !isRecord(answer)
            || typeof answer.questionNo !== 'number'
            || typeof answer.answerText !== 'string'
        ) {
            return null;
        }
        if (
            !Number.isInteger(answer.questionNo)
            || !QUESTION_NUMBERS.has(answer.questionNo)
            || seenQuestions.has(answer.questionNo)
        ) {
            legacyAnswerCount += 1;
            continue;
        }

        seenQuestions.add(answer.questionNo);
        answers.push({ questionNo: answer.questionNo, answerText: answer.answerText });
    }

    return {
        user: {
            id: value.user.id,
            displayName: value.user.displayName,
            membershipStatus: value.user.membershipStatus,
        },
        story: { version: value.story.version, answers, legacyAnswerCount },
    };
}
