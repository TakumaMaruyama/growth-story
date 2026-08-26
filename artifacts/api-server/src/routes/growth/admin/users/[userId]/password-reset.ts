import type { NextRequest } from '@/lib/express-compat';
import { getCurrentUser } from '@/lib/auth';
import {
    issuePasswordResetToken,
    PasswordResetAdminTargetError,
    PasswordResetInactiveTargetError,
    PasswordResetTargetNotFoundError,
} from '@/lib/password-reset-service';
import { jsonResponse, readJsonObject } from '@/lib/request';

interface Props {
    params: Promise<{ userId: string }>;
}

export async function POST(request: NextRequest, { params }: Props) {
    const admin = await getCurrentUser();
    if (!admin) return jsonResponse({ error: '認証が必要です' }, 401);
    if (admin.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    try {
        const json = await readJsonObject(request, 1024);
        if (!json.ok) return json.response;
        if (Object.keys(json.data).length !== 0) {
            return jsonResponse({ error: 'リクエストの形式が正しくありません' }, 400);
        }

        const { userId } = await params;
        const issued = await issuePasswordResetToken(admin.id, userId);
        return jsonResponse({
            fragment: `token=${encodeURIComponent(issued.token)}`,
            expiresAt: issued.expiresAt,
        });
    } catch (error) {
        if (error instanceof PasswordResetTargetNotFoundError) {
            return jsonResponse({ error: 'ユーザーが見つかりません' }, 404);
        }
        if (error instanceof PasswordResetAdminTargetError) {
            return jsonResponse({ error: '管理者の再設定URLは発行できません' }, 400);
        }
        if (error instanceof PasswordResetInactiveTargetError) {
            return jsonResponse({ error: 'ログイン停止を解除してから再設定URLを発行してください' }, 409);
        }
        request.log.error('Password reset link issue error:', error);
        return jsonResponse({ error: '再設定URLを発行できませんでした' }, 500);
    }
}
