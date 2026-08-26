import type { NextRequest } from '@/lib/express-compat';
import { logout } from '@/lib/auth';
import { jsonResponse, validateRequestOrigin } from '@/lib/request';

export async function POST(request: NextRequest) {
    const originError = validateRequestOrigin(request);
    if (originError) return originError;

    try {
        await logout();
        return jsonResponse({ success: true });
    } catch (error) {
        request.log.error('Logout error:', error);
        return jsonResponse({ error: 'ログアウト処理を完了できませんでした' }, 500);
    }
}
