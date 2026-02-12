'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
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

            // Redirect based on role
            if (data.role === 'ADMIN') {
                router.push('/admin/users');
            } else {
                router.push('/');
            }
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
                    ログイン
                </h1>
                <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--secondary)' }}>
                    身長予測 & 私の競泳物語
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

                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link href="/register" style={{ fontSize: '0.875rem' }}>
                        新規登録はこちら
                    </Link>
                    <Link
                        href="/admin/users"
                        style={{ fontSize: '0.75rem', color: 'var(--secondary)', textDecoration: 'none', opacity: 0.7 }}
                    >
                        管理者画面
                    </Link>
                </div>
            </div>
        </div>
    );
}
