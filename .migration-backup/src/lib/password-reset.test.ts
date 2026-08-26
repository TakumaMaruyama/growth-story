import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
    getPasswordResetExpiry,
    isPasswordResetToken,
    PASSWORD_RESET_TTL_MS,
    PASSWORD_RESET_VALID_DAYS,
} from './password-reset-shared';
import {
    generatePasswordResetToken,
    hashPasswordResetToken,
} from './password-reset-token';
import { parsePasswordResetInput } from './password-reset-validation';

test('password reset tokens are 256-bit, hashed, and expire after exactly two days', () => {
    const tokens = Array.from({ length: 100 }, () => generatePasswordResetToken());
    assert.equal(new Set(tokens).size, tokens.length);
    for (const token of tokens) {
        assert.equal(isPasswordResetToken(token), true);
        assert.match(token, /^[A-Za-z0-9_-]{43}$/);
        assert.match(hashPasswordResetToken(token), /^[a-f0-9]{64}$/);
        assert.notEqual(hashPasswordResetToken(token), token);
    }

    const createdAt = new Date('2026-08-04T00:00:00.000Z');
    const expiresAt = getPasswordResetExpiry(createdAt);
    assert.equal(PASSWORD_RESET_VALID_DAYS, 2);
    assert.equal(expiresAt.getTime() - createdAt.getTime(), PASSWORD_RESET_TTL_MS);
    assert.equal(expiresAt.toISOString(), '2026-08-06T00:00:00.000Z');
});

test('password reset input accepts only one valid token and a valid new password', () => {
    const token = generatePasswordResetToken();
    assert.deepEqual(parsePasswordResetInput({ token, password: 'new-pass-2026' }), {
        ok: true,
        value: { token, password: 'new-pass-2026' },
    });

    assert.equal(parsePasswordResetInput({ token: 'short', password: 'new-pass-2026' }).ok, false);
    assert.equal(parsePasswordResetInput({ token, password: 'short' }).ok, false);
    assert.equal(parsePasswordResetInput({ token, password: 'new-pass-2026', role: 'ADMIN' }).ok, false);
});

test('login, help, reset, and admin pages explain the two-day one-use flow', async () => {
    const [login, forgot, reset, admin] = await Promise.all([
        readFile(path.join(process.cwd(), 'src/components/LoginForm.tsx'), 'utf8'),
        readFile(path.join(process.cwd(), 'src/app/forgot-password/page.tsx'), 'utf8'),
        readFile(path.join(process.cwd(), 'src/app/reset-password/page.tsx'), 'utf8'),
        readFile(path.join(process.cwd(), 'src/app/admin/users/page.tsx'), 'utf8'),
    ]);

    assert.match(login, /パスワードを忘れた方/);
    assert.match(forgot, /発行から2日間有効/);
    assert.match(forgot, /新規会員登録はしないでください/);
    assert.match(reset, /1回だけ使用できます/);
    assert.match(reset, /既存のログインはすべて終了/);
    assert.match(admin, /本人・保護者確認/);
    assert.match(admin, /再設定URLをコピー/);
    assert.match(admin, /passwordResetSectionRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
    assert.match(admin, /passwordResetSectionRef\.current\?\.scrollIntoView\(\{ block: 'center' \}\)/);
    assert.match(admin, /tabIndex=\{-1\}/);
});
