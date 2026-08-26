import type { NextRequest } from '@/lib/express-compat';
import { getCurrentUser } from '@/lib/auth';
import { competitionGoalWriteRateLimitRules } from '@/lib/competition-goal-rate-limit';
import {
    CompetitionGoalNotFoundError,
    CompetitionGoalVersionConflictError,
    deleteArchivedCompetitionGoal,
} from '@/lib/competition-goal-service';
import { parseCompetitionGoalDeleteInput } from '@/lib/competition-goal-validation';
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

export async function DELETE(request: NextRequest, { params }: Props) {
    const user = await getCurrentUser();
    if (!user) return jsonResponse({ error: '認証が必要です' }, 401);
    if (user.role !== 'USER') return jsonResponse({ error: 'この機能は選手専用です' }, 403);
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

        const json = await readJsonObject(request, 8 * 1024);
        if (!json.ok) return json.response;
        const input = parseCompetitionGoalDeleteInput(json.data);
        if (!input.ok) return jsonResponse({ error: input.error }, 400);

        const { goalId } = await params;
        await deleteArchivedCompetitionGoal(user.id, goalId, input.value.baseRevision);
        return jsonResponse({ success: true });
    } catch (error) {
        if (error instanceof MembershipWriteBlockedError) {
            return jsonResponse({
                error: MEMBERSHIP_WITHDRAWN_MESSAGE,
                code: MEMBERSHIP_WITHDRAWN_CODE,
            }, 403);
        }
        if (error instanceof CompetitionGoalNotFoundError) {
            return jsonResponse({ error: '過去の大会目標が見つかりません' }, 404);
        }
        if (error instanceof CompetitionGoalVersionConflictError) {
            return jsonResponse({
                error: '別の画面で大会目標が更新されました。再読み込みして内容を確認してください',
                code: 'GOAL_VERSION_CONFLICT',
                currentRevision: error.currentRevision,
            }, 409);
        }
        request.log.error('Competition goal permanent delete error:', error);
        return jsonResponse({ error: '過去の大会目標を削除できませんでした' }, 500);
    }
}
