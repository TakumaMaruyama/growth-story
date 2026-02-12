'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RegisterPage() {
    const router = useRouter();
    const [loginId, setLoginId] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('パスワード確認が一致しません');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loginId, displayName, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || '登録に失敗しました');
                return;
            }

            router.push('/');
        } catch {
            setError('通信エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: '460px', marginTop: '4rem' }}>
            <div className="card">
                <h1 className="page-title" style={{ textAlign: 'center' }}>
                    新規登録
                </h1>
                <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--secondary)' }}>
                    利用者アカウントを作成します
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="loginId" className="form-label">ログインID</label>
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
                        <label htmlFor="displayName" className="form-label">表示名</label>
                        <input
                            type="text"
                            id="displayName"
                            className="form-input"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                            autoComplete="nickname"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">パスワード</label>
                        <input
                            type="password"
                            id="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword" className="form-label">パスワード確認</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            className="form-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete="new-password"
                        />
                    </div>

                    {error && <p className="error-message">{error}</p>}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1rem' }}
                        disabled={loading}
                    >
                        {loading ? '登録中...' : '登録する'}
                    </button>
                </form>

                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <Link href="/login" style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                        ログイン画面に戻る
                    </Link>
                </div>
            </div>
        </div>
    );
}
