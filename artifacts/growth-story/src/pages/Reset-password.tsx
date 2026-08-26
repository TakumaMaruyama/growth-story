
import { Link } from 'wouter';
import { useEffect, useState } from 'react';
import { MIN_USER_PASSWORD_LENGTH } from '@/lib/limits';
import { isPasswordResetToken } from '@/lib/password-reset-shared';

type LinkState = 'loading' | 'ready' | 'invalid';

export default function ResetPasswordPage() {
    const [linkState, setLinkState] = useState<LinkState>('loading');
    const [token, setToken] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [completed, setCompleted] = useState(false);

    useEffect(() => {
        let timeout: number | undefined;

        const readResetLink = () => {
            const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
            const candidate = fragment.get('token') ?? '';

            // Keep the bearer token out of access logs and Referer headers, then
            // remove it from the address bar as soon as the page has read it.
            window.history.replaceState(null, '', window.location.pathname);

            if (!isPasswordResetToken(candidate)) {
                setToken('');
                setLinkState('invalid');
                return;
            }
            setToken(candidate);
            setLinkState('ready');
        };

        const scheduleResetLinkRead = () => {
            if (timeout !== undefined) window.clearTimeout(timeout);
            timeout = window.setTimeout(readResetLink, 0);
        };

        window.addEventListener('hashchange', scheduleResetLinkRead);
        scheduleResetLinkRead();
        return () => {
            window.removeEventListener('hashchange', scheduleResetLinkRead);
            if (timeout !== undefined) window.clearTimeout(timeout);
        };
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        if (linkState !== 'ready' || !token) return;
        if (password !== confirmPassword) {
            setError('確認用パスワードが一致しません');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/auth/password-reset', { credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const data = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) {
                setError(data?.error ?? 'パスワードを再設定できませんでした');
                return;
            }
            setToken('');
            setPassword('');
            setConfirmPassword('');
            setCompleted(true);
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
                    <p className="eyebrow" style={{ marginTop: '0.75rem' }}>Password reset</p>
                    <h1 className="page-title">パスワード再設定</h1>
                    <p className="muted">新しいパスワードを設定します。</p>
                </div>

                {linkState === 'loading' ? (
                    <div className="card loading-state" role="status">再設定URLを確認しています…</div>
                ) : completed ? (
                    <div className="card">
                        <div className="alert alert-success" role="status">
                            <p>パスワードを再設定しました。</p>
                            <p>安全のため、これまでログインしていた端末はすべてログアウトしました。</p>
                        </div>
                        <Link href="/login" className="btn btn-primary btn-block">新しいパスワードでログイン</Link>
                    </div>
                ) : linkState === 'invalid' ? (
                    <div className="card" role="alert">
                        <p className="error-message">
                            この再設定URLは無効です。管理者へ新しいURLを依頼してください。
                        </p>
                        <div className="auth-links">
                            <Link href="/forgot-password">再設定方法を確認</Link>
                            <Link href="/login">ログインへ戻る</Link>
                        </div>
                    </div>
                ) : (
                    <div className="card">
                        <div className="alert alert-info">
                            <p>このURLは発行から2日間有効で、1回だけ使用できます。</p>
                            <p>設定が完了すると、ほかの端末を含む既存のログインはすべて終了します。</p>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="newPassword" className="form-label">新しいパスワード</label>
                                <input
                                    type="password"
                                    id="newPassword"
                                    className="form-input"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                    minLength={MIN_USER_PASSWORD_LENGTH}
                                    autoComplete="new-password"
                                    disabled={loading}
                                    aria-invalid={Boolean(error)}
                                    aria-describedby="password-reset-help"
                                />
                                <p id="password-reset-help" className="form-help">
                                    {MIN_USER_PASSWORD_LENGTH}文字以上で入力してください。
                                </p>
                            </div>
                            <div className="form-group">
                                <label htmlFor="confirmPassword" className="form-label">新しいパスワード（確認）</label>
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
                                    aria-invalid={Boolean(error)}
                                />
                            </div>

                            {error && <p className="error-message" role="alert">{error}</p>}

                            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                                {loading ? '再設定中…' : 'パスワードを再設定'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </main>
    );
}
