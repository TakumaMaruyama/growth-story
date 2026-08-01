import type {
    CompetitionGoalApiType,
    CompetitionGoalDatabaseType,
} from './competition-goal-contract';

export type CompetitionGoalDisplayType =
    | CompetitionGoalApiType
    | CompetitionGoalDatabaseType;

export type CompetitionGoalTextField = 'title' | 'details';

export function getCompetitionGoalFieldMapping(type: CompetitionGoalDisplayType): {
    meetNameField: CompetitionGoalTextField;
    goalTextField: CompetitionGoalTextField;
} {
    const milestone = type === 'milestone' || type === 'MILESTONE';
    return milestone
        ? { meetNameField: 'title', goalTextField: 'details' }
        : { meetNameField: 'details', goalTextField: 'title' };
}

export function getCompetitionGoalDisplayValues(goal: {
    type: CompetitionGoalDisplayType;
    title: string;
    details: string | null;
}): { meetName: string; goalText: string } {
    const { meetNameField, goalTextField } = getCompetitionGoalFieldMapping(goal.type);
    return {
        meetName: (goal[meetNameField] ?? '').trim(),
        goalText: (goal[goalTextField] ?? '').trim(),
    };
}
