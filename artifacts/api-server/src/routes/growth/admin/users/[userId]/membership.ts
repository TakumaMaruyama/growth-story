import type { MembershipStatus } from '@prisma/client';
import type { NextRequest } from '@/lib/express-compat';
import { getCurrentUser } from '@/lib/auth';
import {
    MembershipAdminTargetError,
    MembershipUserNotFoundError,
    setMembershipStatus,
} from '@/lib/member-access';
import { jsonResponse, readJsonObject } from '@/lib/request';

interface Props {
    params: Promise<{ userId: string }>;
}

function isMembershipStatus(value: unknown): value is MembershipStatus {
    return value === 'ACTIVE' || value === 'WITHDRAWN';
}

export async function POST(request: NextRequest, { params }: Props) {
    const admin = await getCurrentUser();
    if (!admin) return jsonResponse({ error: '認証が必要です' }, 401);
    if (admin.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    try {
        const json = await readJsonObject(request, 8 * 1024);
        if (!json.ok) return json.response;
        if (
            Object.keys(json.data).some((key) => key !== 'membershipStatus')
            || !isMembershipStatus(json.data.membershipStatus)
        ) {
            return jsonResponse({ error: '会員状態を正しく指定してください' }, 400);
        }

        const { userId } = await params;
        const result = await setMembershipStatus(
            admin.id,
            userId,
            json.data.membershipStatus,
        );
        return jsonResponse({
            success: true,
            unchanged: !result.changed,
            membershipStatus: json.data.membershipStatus,
            withdrawnAt: result.withdrawnAt,
        });
    } catch (error) {
        if (error instanceof MembershipUserNotFoundError) {
            return jsonResponse({ error: 'ユーザーが見つかりません' }, 404);
        }
        if (error instanceof MembershipAdminTargetError) {
            return jsonResponse({ error: '管理者の会員状態は変更できません' }, 400);
        }
        request.log.error('Membership status change error:', error);
        return jsonResponse({ error: '会員状態を変更できませんでした' }, 500);
    }
}
