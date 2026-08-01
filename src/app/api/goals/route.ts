import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { serializeCompetitionGoal } from '@/lib/competition-goal-contract';
import { competitionGoalWriteRateLimitRules } from '@/lib/competition-goal-rate-limit';
import {
    CompetitionGoalLimitError,
    CompetitionGoalInvalidInputError,
    CompetitionGoalSingletonConflictError,
    createCompetitionGoal,
    listCompetitionGoals,
} from '@/lib/competition-goal-service';
import { parseCompetitionGoalCreateInput } from '@/lib/competition-goal-validation';
import { consumeRateLimits } from '@/lib/rate-limit';
import { jsonResponse, readJsonObject } from '@/lib/request';
import {
    MAX_ACTIVE_MILESTONE_GOALS,
    MAX_COMPETITION_GOALS_PER_USER,
} from '@/lib/limits';

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return jsonResponse({ error: '認証が必要です' }, 401);
    if (user.role !== 'USER') return jsonResponse({ error: 'この機能は選手専用です' }, 403);

    try {
        const allGoals = await listCompetitionGoals(user.id, true);
        const goals = allGoals.filter((goal) => goal.isActive);
        const archivedGoals = allGoals
            .filter((goal) => !goal.isActive)
            .sort((left, right) => (
                (right.archivedAt?.getTime() ?? 0) - (left.archivedAt?.getTime() ?? 0)
            ));
        return jsonResponse({
            user: { id: user.id, displayName: user.displayName },
            goals: goals.map(serializeCompetitionGoal),
            archivedGoals: archivedGoals.map(serializeCompetitionGoal),
        });
    } catch (error) {
        console.error('Competition goal read error:', error);
        return jsonResponse({ error: '大会目標を読み込めませんでした' }, 500);
    }
}

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return jsonResponse({ error: '認証が必要です' }, 401);
    if (user.role !== 'USER') return jsonResponse({ error: 'この機能は選手専用です' }, 403);

    try {
        const rateLimit = await consumeRateLimits(competitionGoalWriteRateLimitRules(user.id));
        if (!rateLimit.allowed) {
            const response = jsonResponse(
                { error: '保存回数が多すぎます。しばらく待ってから再度お試しください' },
                429,
            );
            response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
            return response;
        }

        const json = await readJsonObject(request, 32 * 1024);
        if (!json.ok) return json.response;
        const input = parseCompetitionGoalCreateInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const goal = await createCompetitionGoal(user.id, input.value);
        return jsonResponse({
            success: true,
            goal: serializeCompetitionGoal(goal),
            created: true,
        }, 201);
    } catch (error) {
        if (error instanceof CompetitionGoalSingletonConflictError) {
            return jsonResponse({
                error: 'この種類の有効な目標はすでにあります。現在の目標を編集してください',
                code: 'GOAL_SINGLETON_CONFLICT',
            }, 409);
        }
        if (error instanceof CompetitionGoalLimitError) {
            if (error.kind === 'total') {
                return jsonResponse({
                    error: `大会目標の保存上限（${MAX_COMPETITION_GOALS_PER_USER}件）に達しました。過去の目標を整理してから再度お試しください`,
                    code: 'GOAL_TOTAL_LIMIT',
                }, 409);
            }
            return jsonResponse({
                error: `期限つき目標の登録上限（${MAX_ACTIVE_MILESTONE_GOALS}件）に達しました`,
                code: 'GOAL_ACTIVE_LIMIT',
            }, 409);
        }
        if (error instanceof CompetitionGoalInvalidInputError) {
            return jsonResponse({ error: error.message }, 400);
        }
        console.error('Competition goal create error:', error);
        return jsonResponse({ error: '大会目標を保存できませんでした' }, 500);
    }
}
