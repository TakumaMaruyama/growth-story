'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { loginHref, postLoginDestination } from '@/lib/return-path';

interface LoginFormProps {
    adminOnly?: boolean;
    returnTo?: string | null;
}

export default function LoginForm({ adminOnly = false, returnTo = null }: LoginFormProps) {
    const router = useRouter();
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loginId, password, adminOnly }),
            });
            const data = await response.json().catch(() => null) as {
                error?: string;
                role?: 'USER' | 'ADMIN';
            } | null;
            if (!response.ok) {
                setError(data?.error ?? 'ログインできませんでした');
                return;
            }

            const destination = postLoginDestination(data?.role, returnTo);
            if (!destination) {
                setError('ログイン結果を確認できませんでした。もう一度お試しください');
                return;
            }
            router.replace(destination);
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
                    <p className="eyebrow" style={{ marginTop: '0.75rem' }}>My swim story</p>
                    <h1 className="page-title">{adminOnly ? '管理者ログイン' : '私の競泳物語'}</h1>
                    <p className="muted">
                        {adminOnly
                            ? '管理者アカウントでログインしてください。'
                            : '練習日誌、大会目標、競泳物語を、自分の言葉で残す場所。'}
                    </p>
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
                                autoComplete="username"
                                autoFocus
                                disabled={loading}
                                aria-invalid={Boolean(error)}
                                aria-describedby={error ? 'login-error' : undefined}
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
                                autoComplete="current-password"
                                disabled={loading}
                                aria-invalid={Boolean(error)}
                                aria-describedby={error ? 'login-error' : undefined}
                            />
                        </div>

                        {error && <p id="login-error" className="error-message" role="alert">{error}</p>}

                        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                            {loading ? 'ログイン中…' : 'ログイン'}
                        </button>
                    </form>

                    <div className="auth-links">
                        {adminOnly ? (
                            <Link href="/login">通常ログインへ戻る</Link>
                        ) : (
                            <>
                                <Link href={returnTo ? `/register?next=${encodeURIComponent(returnTo)}` : '/register'}>
                                    新しくアカウントを作る
                                </Link>
                                <Link href={loginHref(null, 'admin')}>管理者ログイン</Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
