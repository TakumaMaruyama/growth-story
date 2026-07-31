'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MIN_PASSWORD_LENGTH } from '@/lib/limits';

export default function RegisterPage() {
    const router = useRouter();
    const [loginId, setLoginId] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('確認用パスワードが一致しません');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loginId, displayName, password }),
            });
            const data = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) {
                setError(data?.error ?? 'アカウントを作成できませんでした');
                return;
            }
            router.replace('/');
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
                    <h1 className="page-title">アカウントを作る</h1>
                    <p className="muted">あなた自身の練習日誌と競泳物語を始めましょう。</p>
                </div>

                <div className="card">
                    <form onSubmit={handleSubmit}>
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
                            <label htmlFor="displayName" className="form-label">表示名</label>
                            <input
                                type="text"
                                id="displayName"
                                className="form-input"
                                value={displayName}
                                onChange={(event) => setDisplayName(event.target.value)}
                                required
                                maxLength={80}
                                autoComplete="nickname"
                                disabled={loading}
                            />
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
                                minLength={MIN_PASSWORD_LENGTH}
                                autoComplete="new-password"
                                disabled={loading}
                                aria-describedby="password-help"
                            />
                            <p id="password-help" className="form-help">{MIN_PASSWORD_LENGTH}文字以上で設定してください。</p>
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
                                minLength={MIN_PASSWORD_LENGTH}
                                autoComplete="new-password"
                                disabled={loading}
                            />
                        </div>

                        {error && <p className="error-message" role="alert">{error}</p>}

                        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                            {loading ? '作成中…' : 'アカウントを作成'}
                        </button>
                    </form>

                    <div className="auth-links">
                        <Link href="/login">ログインへ戻る</Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
