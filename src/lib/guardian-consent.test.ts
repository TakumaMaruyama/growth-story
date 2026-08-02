import assert from 'node:assert/strict';
import test from 'node:test';
import {
    GUARDIAN_CONSENT_LABEL,
    GUARDIAN_CONSENT_NOTICE,
    GUARDIAN_CONSENT_NOTICE_VERSION,
} from './guardian-consent';

test('guardian registration uses the approved notice and consent wording', () => {
    assert.deepEqual(GUARDIAN_CONSENT_NOTICE, [
        '本サービスに入力された内容（日誌、大会目標、競泳物語）は、指導およびサービス運営のため、管理者も確認できます。',
        '退会または保護者同意の撤回後は、日誌・大会目標・競泳物語の新規入力および更新ができなくなります。過去に登録した内容は閲覧のみ可能です。利用再開には管理者による手続きが必要です。',
    ]);
    assert.equal(GUARDIAN_CONSENT_LABEL, '上記の内容を確認し、保護者として同意します');
    assert.equal(GUARDIAN_CONSENT_NOTICE_VERSION, '2026-08-03-v1');
});
