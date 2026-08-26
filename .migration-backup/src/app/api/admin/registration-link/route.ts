import { getCurrentUser } from '@/lib/auth';
import { jsonResponse } from '@/lib/request';
import { getConfiguredSharedRegistrationToken } from '@/lib/shared-registration';

export async function GET() {
    const admin = await getCurrentUser();
    if (!admin) return jsonResponse({ error: '認証が必要です' }, 401);
    if (admin.role !== 'ADMIN') return jsonResponse({ error: '権限がありません' }, 403);

    const token = getConfiguredSharedRegistrationToken();
    if (!token) {
        return jsonResponse({ error: '共通登録URLが設定されていません' }, 503);
    }

    return jsonResponse({ fragment: `access=${encodeURIComponent(token)}` });
}
