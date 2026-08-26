import type { NextRequest } from '@/lib/express-compat';
import { getCurrentUser } from '@/lib/auth';
import { serializeCompetitionGoal } from '@/lib/competition-goal-contract';
import { competitionGoalWriteRateLimitRules } from '@/lib/competition-goal-rate-limit';
import {
    CompetitionGoalInvalidInputError,
    CompetitionGoalNotFoundError,
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
    canMemberWrite,
    MEMBERSHIP_WITHDRAWN_CODE,
    MEMBERSHIP_WITHDRAWN_MESSAGE,
    MembershipWriteBlockedError,
} from '@/lib/member-access';

interface Props {
    params: Promise<{ goalId: string }>;
}

async function authorizeWrite() {
    const user = await getCurrentUser();
    if (!user) return { response: jsonResponse({ error: '認証が必要です' }, 401) } as const;
    if (user.role !== 'USER') {
        return { response: jsonResponse({ error: 'この機能は選手専用です' }, 403) } as const;
    }
    if (!canMemberWrite(user)) {
        return {
            response: jsonResponse({
                error: MEMBERSHIP_WITHDRAWN_MESSAGE,
                code: MEMBERSHIP_WITHDRAWN_CODE,
            }, 403),
        } as const;
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
    if (error instanceof MembershipWriteBlockedError) {
        return jsonResponse({
            error: MEMBERSHIP_WITHDRAWN_MESSAGE,
            code: MEMBERSHIP_WITHDRAWN_CODE,
        }, 403);
    }
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
        request.log.error('Competition goal update error:', error);
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
        request.log.error('Competition goal archive error:', error);
        return jsonResponse({ error: '大会目標を過去の目標へ移動できませんでした' }, 500);
    }
}
