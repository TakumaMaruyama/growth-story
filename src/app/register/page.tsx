'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
    GUARDIAN_CONSENT_LABEL,
    GUARDIAN_CONSENT_NOTICE,
} from '@/lib/guardian-consent';
import {
    MAX_GUARDIAN_NAME_LENGTH,
    MAX_GUARDIAN_RELATIONSHIP_LENGTH,
    MIN_USER_PASSWORD_LENGTH,
} from '@/lib/limits';
import { loginHref, sanitizeReturnPath } from '@/lib/return-path';

type InviteState =
    | { status: 'loading' }
    | { status: 'invalid'; error: string }
    | { status: 'valid'; athleteName: string; expiresAt: string };

function RegisterPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = sanitizeReturnPath(searchParams.get('next'), 'user');
    const inviteToken = searchParams.get('invite') ?? '';
    const [inviteState, setInviteState] = useState<InviteState>({ status: 'loading' });
    const [loginId, setLoginId] = useState('');
    const [guardianName, setGuardianName] = useState('');
    const [guardianRelationship, setGuardianRelationship] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [guardianConsent, setGuardianConsent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        if (!inviteToken) {
            const timeout = window.setTimeout(() => {
                setInviteState({
                    status: 'invalid',
                    error: '会員登録には、管理者から送られた登録URLが必要です。',
                });
            }, 0);
            return () => {
                window.clearTimeout(timeout);
                controller.abort();
            };
        }

        const validateInvite = async () => {
            setInviteState({ status: 'loading' });
            try {
                const response = await fetch(
                    `/api/auth/register?invite=${encodeURIComponent(inviteToken)}`,
                    { cache: 'no-store', signal: controller.signal },
                );
                const data = await response.json().catch(() => null) as {
                    athleteName?: string;
                    expiresAt?: string;
                    error?: string;
                } | null;
                if (
                    !response.ok
                    || typeof data?.athleteName !== 'string'
                    || typeof data.expiresAt !== 'string'
                ) {
                    setInviteState({
                        status: 'invalid',
                        error: data?.error ?? 'この登録URLは利用できません。管理者へ再発行を依頼してください。',
                    });
                    return;
                }
                setInviteState({
                    status: 'valid',
                    athleteName: data.athleteName,
                    expiresAt: data.expiresAt,
                });
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
                setInviteState({
                    status: 'invalid',
                    error: '登録URLを確認できませんでした。通信を確認して、もう一度お試しください。',
                });
            }
        };

        void validateInvite();
        return () => controller.abort();
    }, [inviteToken]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        if (inviteState.status !== 'valid') return;
        if (!guardianConsent) {
            setError('登録前の内容を確認し、保護者として同意してください');
            return;
        }
        if (password !== confirmPassword) {
            setError('確認用パスワードが一致しません');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inviteToken,
                    loginId,
                    guardianName,
                    guardianRelationship,
                    password,
                    guardianConsent,
                }),
            });
            const data = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) {
                setError(data?.error ?? 'アカウントを作成できませんでした');
                if (response.status === 410) {
                    setInviteState({
                        status: 'invalid',
                        error: data?.error ?? 'この登録URLは利用できません。管理者へ再発行を依頼してください。',
                    });
                }
                return;
            }
            router.replace(returnTo ?? '/');
            router.refresh();
        } catch {
            setError('通信を確認して、もう一度お試しください');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main id="main-content" className="auth-shell">
            <div className="auth-card">
                <div className="auth-brand">
                    <span className="brand-mark" aria-hidden="true">S</span>
                    <p className="eyebrow" style={{ marginTop: '0.75rem' }}>Join</p>
                    <h1 className="page-title">会員登録</h1>
                    <p className="muted">練習日誌、大会目標、競泳物語を始めましょう。</p>
                </div>

                {inviteState.status === 'loading' ? (
                    <div className="card loading-state" role="status">登録URLを確認しています…</div>
                ) : inviteState.status === 'invalid' ? (
                    <div className="card" role="alert">
                        <p className="error-message">{inviteState.error}</p>
                        <div className="auth-links">
                            <Link href={loginHref(returnTo, 'user')}>ログインへ戻る</Link>
                        </div>
                    </div>
                ) : (
                    <div className="card">
                        <div className="alert alert-info" aria-labelledby="registration-notice-heading">
                            <h2 id="registration-notice-heading" className="section-title">登録前にご確認ください</h2>
                            {GUARDIAN_CONSENT_NOTICE.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="athleteName" className="form-label">選手名</label>
                                <input
                                    type="text"
                                    id="athleteName"
                                    className="form-input"
                                    value={inviteState.athleteName}
                                    readOnly
                                    aria-readonly="true"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="guardianName" className="form-label">保護者氏名</label>
                                <input
                                    type="text"
                                    id="guardianName"
                                    className="form-input"
                                    value={guardianName}
                                    onChange={(event) => setGuardianName(event.target.value)}
                                    required
                                    maxLength={MAX_GUARDIAN_NAME_LENGTH}
                                    autoComplete="name"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="guardianRelationship" className="form-label">選手との関係</label>
                                <select
                                    id="guardianRelationship"
                                    className="form-input"
                                    value={guardianRelationship}
                                    onChange={(event) => setGuardianRelationship(event.target.value)}
                                    required
                                    disabled={loading}
                                >
                                    <option value="">選択してください</option>
                                    <option value="父">父</option>
                                    <option value="母">母</option>
                                    <option value="祖父母">祖父母</option>
                                    <option value="その他の保護者">その他の保護者</option>
                                </select>
                                <p className="form-help">{guardianRelationship.length}/{MAX_GUARDIAN_RELATIONSHIP_LENGTH}文字</p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="loginId" className="form-label">ログインID</label>
                                <input
                                    type="text"
                                    id="loginId"
                                    className="form-input"
                                    value={loginId}
                                    onChange={(event) => setLoginId(event.target.value)}
                                    required
                                    minLength={3}
                                    maxLength={64}
                                    autoComplete="username"
                                    disabled={loading}
                                    aria-describedby="login-id-help"
                                />
                                <p id="login-id-help" className="form-help">3〜64文字。文字・数字・「.」「-」「_」が使えます。</p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="password" className="form-label">パスワード</label>
                                <input
                                    type="password"
                                    id="password"
                                    className="form-input"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                    minLength={MIN_USER_PASSWORD_LENGTH}
                                    autoComplete="new-password"
                                    disabled={loading}
                                    aria-describedby="password-help"
                                />
                                <p id="password-help" className="form-help">
                                    {MIN_USER_PASSWORD_LENGTH}文字以上。英数字のみでも設定できます。
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmPassword" className="form-label">パスワード（確認）</label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    className="form-input"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    required
                                    minLength={MIN_USER_PASSWORD_LENGTH}
                                    autoComplete="new-password"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label className="checkbox-label" htmlFor="guardianConsent">
                                    <input
                                        type="checkbox"
                                        id="guardianConsent"
                                        checked={guardianConsent}
                                        onChange={(event) => setGuardianConsent(event.target.checked)}
                                        required
                                        disabled={loading}
                                    />
                                    <span>{GUARDIAN_CONSENT_LABEL}</span>
                                </label>
                            </div>

                            {error && <p className="error-message" role="alert">{error}</p>}

                            <button
                                type="submit"
                                className="btn btn-primary btn-block"
                                disabled={loading || !guardianConsent}
                            >
                                {loading ? '登録中…' : '同意して登録する'}
                            </button>
                        </form>

                        <div className="auth-links">
                            <Link href={loginHref(returnTo, 'user')}>ログインへ戻る</Link>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={(
            <main id="main-content" className="auth-shell">
                <div className="card loading-state" role="status">読み込み中…</div>
            </main>
        )}>
            <RegisterPageContent />
        </Suspense>
    );
}
