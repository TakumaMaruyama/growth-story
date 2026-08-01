import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { serializeCompetitionGoal } from '@/lib/competition-goal-contract';
import { competitionGoalWriteRateLimitRules } from '@/lib/competition-goal-rate-limit';
import {
    CompetitionGoalInvalidInputError,
    CompetitionGoalLimitError,
    CompetitionGoalNotFoundError,
    CompetitionGoalSingletonConflictError,
    CompetitionGoalVersionConflictError,
    archiveCompetitionGoal,
    updateCompetitionGoal,
} from '@/lib/competition-goal-service';
import {
    parseCompetitionGoalDeleteInput,
    parseCompetitionGoalUpdateInput,
} from '@/lib/competition-goal-validation';
import { consumeRateLimits } from '@/lib/rate-limit';
import { jsonResponse, readJsonObject } from '@/lib/request';
import {
    MAX_ACTIVE_MILESTONE_GOALS,
    MAX_COMPETITION_GOALS_PER_USER,
} from '@/lib/limits';

interface Props {
    params: Promise<{ goalId: string }>;
}

async function authorizeWrite() {
    const user = await getCurrentUser();
    if (!user) return { response: jsonResponse({ error: '認証が必要です' }, 401) } as const;
    if (user.role !== 'USER') {
        return { response: jsonResponse({ error: 'この機能は選手専用です' }, 403) } as const;
    }

    const rateLimit = await consumeRateLimits(competitionGoalWriteRateLimitRules(user.id));
    if (!rateLimit.allowed) {
        const response = jsonResponse(
            { error: '保存回数が多すぎます。しばらく待ってから再度お試しください' },
            429,
        );
        response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
        return { response } as const;
    }
    return { user } as const;
}

function goalWriteErrorResponse(error: unknown) {
    if (error instanceof CompetitionGoalNotFoundError) {
        return jsonResponse({ error: '大会目標が見つかりません' }, 404);
    }
    if (error instanceof CompetitionGoalVersionConflictError) {
        return jsonResponse({
            error: '別の画面で大会目標が更新されました。再読み込みして内容を確認してください',
            code: 'GOAL_VERSION_CONFLICT',
            currentRevision: error.currentRevision,
        }, 409);
    }
    if (error instanceof CompetitionGoalSingletonConflictError) {
        return jsonResponse({
            error: 'この種類の有効な目標はすでにあります',
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
    return null;
}

export async function PATCH(request: NextRequest, { params }: Props) {
    const authorization = await authorizeWrite();
    if ('response' in authorization) return authorization.response;

    try {
        const json = await readJsonObject(request, 32 * 1024);
        if (!json.ok) return json.response;
        const input = parseCompetitionGoalUpdateInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const { goalId } = await params;
        const goal = await updateCompetitionGoal(authorization.user.id, goalId, input.value);
        return jsonResponse({
            success: true,
            goal: serializeCompetitionGoal(goal),
            created: false,
        });
    } catch (error) {
        const response = goalWriteErrorResponse(error);
        if (response) return response;
        console.error('Competition goal update error:', error);
        return jsonResponse({ error: '大会目標を更新できませんでした' }, 500);
    }
}

export async function DELETE(request: NextRequest, { params }: Props) {
    const authorization = await authorizeWrite();
    if ('response' in authorization) return authorization.response;

    try {
        const json = await readJsonObject(request, 8 * 1024);
        if (!json.ok) return json.response;
        const input = parseCompetitionGoalDeleteInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const { goalId } = await params;
        const goal = await archiveCompetitionGoal(
            authorization.user.id,
            goalId,
            input.value.baseRevision,
        );
        return jsonResponse({ success: true, goal: serializeCompetitionGoal(goal) });
    } catch (error) {
        const response = goalWriteErrorResponse(error);
        if (response) return response;
        console.error('Competition goal archive error:', error);
        return jsonResponse({ error: '大会目標を過去の目標へ移動できませんでした' }, 500);
    }
}
