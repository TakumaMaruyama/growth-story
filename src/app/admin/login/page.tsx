'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminLoginPage() {
    const router = useRouter();
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loginId, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'ログインに失敗しました');
                return;
            }

            if (data.role !== 'ADMIN') {
                // The login API creates a session before returning role.
                // Clear it so USER accounts cannot remain logged in from admin login.
                await fetch('/api/auth/logout', { method: 'POST' });
                setError('管理者アカウントでログインしてください');
                return;
            }

            router.push('/admin/users');
        } catch {
            setError('通信エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: '400px', marginTop: '4rem' }}>
            <div className="card">
                <h1 className="page-title" style={{ textAlign: 'center' }}>
                    管理者ログイン
                </h1>
                <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--secondary)' }}>
                    管理者アカウントでログインしてください
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="loginId" className="form-label">
                            ログインID
                        </label>
                        <input
                            type="text"
                            id="loginId"
                            className="form-input"
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">
                            パスワード
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    {error && <p className="error-message">{error}</p>}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1rem' }}
                        disabled={loading}
                    >
                        {loading ? 'ログイン中...' : 'ログイン'}
                    </button>
                </form>

                <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                    <Link href="/login" style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                        通常ログインへ戻る
                    </Link>
                </div>
            </div>
        </div>
    );
}
