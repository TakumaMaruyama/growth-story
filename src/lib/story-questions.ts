export const STORY_QUESTIONS = [
    { no: 1, label: '今の自分の良いところは？' },
    { no: 2, label: '競泳を始めたきっかけは？' },
    { no: 3, label: '競泳で一番嬉しかった思い出は？' },
    { no: 4, label: '競泳で一番悔しかった思い出は？' },
    { no: 5, label: '自分の得意な泳法は？' },
    { no: 6, label: '尊敬する選手は？その理由は？' },
    { no: 7, label: '今のチーム・コーチの良いところは？' },
    { no: 8, label: '練習で大切にしていることは？' },
    { no: 9, label: '試合前のルーティンは？' },
    { no: 10, label: '今一番頑張っていることは？' },
    { no: 11, label: '1年後の目標は？' },
    { no: 12, label: '3年後の目標は？' },
    { no: 13, label: '将来の夢は？' },
    { no: 14, label: '競泳以外で好きなこと・得意なことは？' },
    { no: 15, label: '自分を応援してくれている人への感謝' },
] as const;

export type StoryQuestionNo = (typeof STORY_QUESTIONS)[number]['no'];
