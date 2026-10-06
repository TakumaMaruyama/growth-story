import type { NextRequest } from '@/lib/express-compat';
import { authorizePersonalRequest, personalAccessErrorResponse } from '@/lib/personal-access';
import { serializeCompetitionGoal } from '@/lib/competition-goal-contract';
import { competitionGoalWriteRateLimitRules } from '@/lib/competition-goal-rate-limit';
import {
    CompetitionGoalInvalidInputError,
    createCompetitionGoal,
    listCompetitionGoals,
} from '@/lib/competition-goal-service';
import { parseCompetitionGoalCreateInput } from '@/lib/competition-goal-validation';
import { consumeRateLimits } from '@/lib/rate-limit';
import { jsonResponse, readJsonObject } from '@/lib/request';
import {
    canMemberWrite,
    MEMBERSHIP_WITHDRAWN_CODE,
    MEMBERSHIP_WITHDRAWN_MESSAGE,
    MembershipWriteBlockedError,
} from '@/lib/member-access';

export async function GET(request: NextRequest) {
    const authorization = await authorizePersonalRequest();
    if ('response' in authorization) return authorization.response;
    const { subject: user, canSwitchToAdmin, writeContext } = authorization.access;

    try {
        const allGoals = await listCompetitionGoals(user.id, true);
        const goals = allGoals.filter((goal) => goal.isActive);
        const archivedGoals = allGoals
            .filter((goal) => !goal.isActive)
            .sort((left, right) => (
                (right.archivedAt?.getTime() ?? 0) - (left.archivedAt?.getTime() ?? 0)
            ));
        return jsonResponse({
            user: {
                id: user.id,
                role: user.role,
                canSwitchToAdmin,
                displayName: user.displayName,
                membershipStatus: user.membershipStatus,
            },
            goals: goals.map(serializeCompetitionGoal),
            archivedGoals: archivedGoals.map(serializeCompetitionGoal),
        });
    } catch (error) {
        const denied = personalAccessErrorResponse(error);
        if (denied) return denied;
        request.log.error('Competition goal read error:', error);
        return jsonResponse({ error: '大会目標を読み込めませんでした' }, 500);
    }
}

export async function POST(request: NextRequest) {
    const authorization = await authorizePersonalRequest(request);
    if ('response' in authorization) return authorization.response;
    const { subject: user, canSwitchToAdmin, writeContext } = authorization.access;
    if (!canMemberWrite(user)) {
        return jsonResponse({
            error: MEMBERSHIP_WITHDRAWN_MESSAGE,
            code: MEMBERSHIP_WITHDRAWN_CODE,
        }, 403);
    }

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

        const goal = await createCompetitionGoal(user.id, input.value, writeContext);
        return jsonResponse({
            success: true,
            goal: serializeCompetitionGoal(goal),
            created: true,
        }, 201);
    } catch (error) {
        const denied = personalAccessErrorResponse(error);
        if (denied) return denied;
        if (error instanceof MembershipWriteBlockedError) {
            return jsonResponse({
                error: MEMBERSHIP_WITHDRAWN_MESSAGE,
                code: MEMBERSHIP_WITHDRAWN_CODE,
            }, 403);
        }
        if (error instanceof CompetitionGoalInvalidInputError) {
            return jsonResponse({ error: error.message }, 400);
        }
        request.log.error('Competition goal create error:', error);
        return jsonResponse({ error: '大会目標を保存できませんでした' }, 500);
    }
}
