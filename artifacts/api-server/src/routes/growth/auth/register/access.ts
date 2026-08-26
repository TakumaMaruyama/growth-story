import type { NextRequest } from '@/lib/express-compat';
import { jsonResponse, readJsonObject } from '@/lib/request';
import {
    getConfiguredSharedRegistrationToken,
    isSharedRegistrationAccessAllowed,
} from '@/lib/shared-registration';

const UNAVAILABLE_REGISTRATION_MESSAGE = 'この登録URLは利用できません。管理者から届いた最新のURLを開いてください';

export async function POST(request: NextRequest) {
    const json = await readJsonObject(request, 4 * 1024);
    if (!json.ok) return json.response;
    if (Object.keys(json.data).some((key) => key !== 'accessToken')) {
        return jsonResponse({ error: 'リクエストの形式が正しくありません' }, 400);
    }

    if (!getConfiguredSharedRegistrationToken()) {
        return jsonResponse({ error: '会員登録を準備中です。管理者へ確認してください' }, 503);
    }
    if (!isSharedRegistrationAccessAllowed(json.data.accessToken)) {
        return jsonResponse({ error: UNAVAILABLE_REGISTRATION_MESSAGE }, 410);
    }

    return jsonResponse({ available: true });
}
