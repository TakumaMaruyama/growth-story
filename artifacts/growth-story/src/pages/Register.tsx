
import { Link } from 'wouter';
import { useLocation, useSearch } from 'wouter';
import { Suspense, useCallback, useEffect, useState } from 'react';
import {
    GUARDIAN_CONSENT_LABEL,
    GUARDIAN_CONSENT_NOTICE,
} from '@/lib/guardian-consent';
import {
    MAX_GUARDIAN_NAME_LENGTH,
    MAX_GUARDIAN_RELATIONSHIP_LENGTH,
    MAX_REAL_NAME_PART_LENGTH,
    MIN_USER_PASSWORD_LENGTH,
} from '@/lib/limits';
import { loginHref, sanitizeReturnPath } from '@/lib/return-path';

type RegistrationLinkState =
    | { status: 'loading' }
    | { status: 'invalid'; error: string; retryable: boolean }
    | { status: 'valid' };

function RegisterPageContent() {
    const [, setLocation] = useLocation();
    const searchString = useSearch();
    const searchParams = new URLSearchParams(searchString);
    const returnTo = sanitizeReturnPath(searchParams.get('next'), 'user');
    const [registrationLinkState, setRegistrationLinkState] = useState<RegistrationLinkState>({ status: 'loading' });
    const [accessToken, setAccessToken] = useState('');
    const [athleteFamilyName, setAthleteFamilyName] = useState('');
    const [athleteGivenName, setAthleteGivenName] = useState('');
    const [loginId, setLoginId] = useState('');
    const [guardianName, setGuardianName] = useState('');
    const [guardianRelationship, setGuardianRelationship] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [guardianConsent, setGuardianConsent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const validateRegistrationLink = useCallback(async (token: string, signal?: AbortSignal) => {
        try {
            const response = await fetch('/api/auth/register/access', { credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: token }),
                cache: 'no-store',
                signal,
            });
            const data = await response.json().catch(() => null) as {
                available?: boolean;
                error?: string;
            } | null;
            if (!response.ok || data?.available !== true) {
                setRegistrationLinkState({
                    status: 'invalid',
                    error: data?.error ?? 'この登録URLは利用できません。管理者から届いた最新のURLを開いてください。',
                    retryable: false,
                });
                return;
            }
            setRegistrationLinkState({ status: 'valid' });
        } catch (fetchError) {
            if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
            setRegistrationLinkState({
                status: 'invalid',
                error: '登録URLを確認できませんでした。通信を確認して、もう一度お試しください。',
                retryable: true,
            });
        }
    }, []);

    useEffect(() => {
        let controller = new AbortController();
        let timeout: number | undefined;

        const readRegistrationLink = () => {
            controller.abort();
            controller = new AbortController();
            const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
            const token = fragment.get('access') ?? '';

            // The shared bearer token is read from the URL fragment so it never reaches
            // access logs or Referer headers, then removed from the address bar.
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${window.location.search}`,
            );

            setAccessToken('');
            if (!token) {
                setRegistrationLinkState({
                    status: 'invalid',
                    error: '会員登録には、管理者から送られた共通登録URLが必要です。',
                    retryable: false,
                });
                return;
            }
            setRegistrationLinkState({ status: 'loading' });
            setAccessToken(token);
            void validateRegistrationLink(token, controller.signal);
        };

        const scheduleRegistrationLinkRead = () => {
            if (timeout !== undefined) window.clearTimeout(timeout);
            timeout = window.setTimeout(readRegistrationLink, 0);
        };

        window.addEventListener('hashchange', scheduleRegistrationLinkRead);
        scheduleRegistrationLinkRead();
        return () => {
            window.removeEventListener('hashchange', scheduleRegistrationLinkRead);
            if (timeout !== undefined) window.clearTimeout(timeout);
            controller.abort();
        };
    }, [validateRegistrationLink]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        if (registrationLinkState.status !== 'valid') return;
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
            const response = await fetch('/api/auth/register', { credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessToken,
                    athleteFamilyName,
                    athleteGivenName,
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
                    setRegistrationLinkState({
                        status: 'invalid',
                        error: data?.error ?? 'この登録URLは利用できません。管理者から届いた最新のURLを開いてください。',
                        retryable: false,
                    });
                }
                return;
            }
            setLocation(returnTo ?? '/');
            window.location.reload();
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

                {registrationLinkState.status === 'loading' ? (
                    <div className="card loading-state" role="status">登録URLを確認しています…</div>
                ) : registrationLinkState.status === 'invalid' ? (
                    <div className="card" role="alert">
                        <p className="error-message">{registrationLinkState.error}</p>
                        {registrationLinkState.retryable && accessToken && (
                            <button
                                type="button"
                                className="btn btn-primary btn-block"
                                onClick={() => {
                                    setRegistrationLinkState({ status: 'loading' });
                                    void validateRegistrationLink(accessToken);
                                }}
                            >
                                登録URLを再確認
                            </button>
                        )}
                        <div className="auth-links">
                            <Link href={loginHref(returnTo, 'user')}>ログインへ戻る</Link>
                        </div>
                    </div>
                ) : (
                    <div className="card">
                        <div className="alert alert-info" aria-labelledby="registration-notice-heading">
                            <h2 id="registration-notice-heading" className="section-title">登録前にご確認ください</h2>
                            <p>管理者から案内を受けた保護者のみ登録できます。選手本人の本名を正確に入力してください。</p>
                            <p>選手本人の画面には本名の「名」のみ表示し、管理者画面では会員を識別するため本名を表示します。</p>
                            <p>すでに登録済み、または退会した選手は新規登録せず、管理者へ利用再開を依頼してください。</p>
                            {GUARDIAN_CONSENT_NOTICE.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group" role="group" aria-labelledby="athlete-real-name-label" aria-describedby="athlete-real-name-help">
                                <p id="athlete-real-name-label" className="form-label">選手本人の本名</p>
                                <div className="name-fields">
                                    <label htmlFor="athleteFamilyName">
                                        <span>姓</span>
                                        <input
                                            type="text"
                                            id="athleteFamilyName"
                                            className="form-input"
                                            value={athleteFamilyName}
                                            onChange={(event) => setAthleteFamilyName(event.target.value)}
                                            required
                                            maxLength={MAX_REAL_NAME_PART_LENGTH}
                                            autoComplete="section-athlete family-name"
                                            disabled={loading}
                                        />
                                    </label>
                                    <label htmlFor="athleteGivenName">
                                        <span>名</span>
                                        <input
                                            type="text"
                                            id="athleteGivenName"
                                            className="form-input"
                                            value={athleteGivenName}
                                            onChange={(event) => setAthleteGivenName(event.target.value)}
                                            required
                                            maxLength={MAX_REAL_NAME_PART_LENGTH}
                                            autoComplete="section-athlete given-name"
                                            disabled={loading}
                                        />
                                    </label>
                                </div>
                                <p id="athlete-real-name-help" className="form-help">
                                    姓・名とも本名を入力してください。アプリ内では「名」を表示します。
                                </p>
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
                                    autoComplete="section-guardian name"
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
