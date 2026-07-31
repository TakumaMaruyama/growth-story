'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import { MIN_PASSWORD_LENGTH } from '@/lib/limits';

interface UserInfo {
    displayName: string;
}

interface UserListItem {
    id: string;
    loginId: string;
    displayName: string;
    role: 'USER' | 'ADMIN';
    isActive: boolean;
    createdAt: string;
}

interface UserPage {
    adminUser: UserInfo;
    users: UserListItem[];
    nextCursor: string | null;
    error?: string;
}

export default function AdminUsersPage() {
    const router = useRouter();
    const [adminUser, setAdminUser] = useState<UserInfo | null>(null);
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [retryCursor, setRetryCursor] = useState<string | null>(null);
    const [retryAppend, setRetryAppend] = useState(false);

    const [loginId, setLoginId] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [creating, setCreating] = useState(false);
    const [createMessage, setCreateMessage] = useState('');
    const [createError, setCreateError] = useState('');
    const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(() => new Set());
    const [toggleErrors, setToggleErrors] = useState<Record<string, string>>({});

    const redirectForAuthorization = useCallback((status: number) => {
        if (status === 401) {
            router.replace('/admin/login');
            return true;
        }
        if (status === 403) {
            router.replace('/');
            return true;
        }
        return false;
    }, [router]);

    const fetchUsers = useCallback(async (cursor?: string, append = false) => {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setLoadError('');
        try {
            const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
            const response = await fetch(`/api/admin/users${query}`, { cache: 'no-store' });
            const data = await response.json().catch(() => null) as UserPage | null;
            if (redirectForAuthorization(response.status)) return;
            if (!response.ok || !data) {
                setLoadError(data?.error ?? 'ユーザー一覧を読み込めませんでした');
                setRetryCursor(cursor ?? null);
                setRetryAppend(append);
                return;
            }
            setAdminUser(data.adminUser);
            setUsers((current) => append ? [...current, ...data.users] : data.users);
            setNextCursor(data.nextCursor);
        } catch {
            setLoadError('通信を確認して、もう一度お試しください');
            setRetryCursor(cursor ?? null);
            setRetryAppend(append);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [redirectForAuthorization]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void fetchUsers(), 0);
        return () => window.clearTimeout(timeout);
    }, [fetchUsers]);

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault();
        setCreateError('');
        setCreateMessage('');
        if (password !== passwordConfirmation) {
            setCreateError('初期パスワードと確認用パスワードが一致しません');
            return;
        }
        setCreating(true);

        try {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loginId, displayName, password }),
            });
            const data = await response.json().catch(() => null) as { error?: string } | null;
            if (redirectForAuthorization(response.status)) return;
            if (!response.ok) {
                setCreateError(data?.error ?? 'ユーザーを作成できませんでした');
                return;
            }
            setCreateMessage('ユーザーを作成しました');
            setLoginId('');
            setDisplayName('');
            setPassword('');
            setPasswordConfirmation('');
            await fetchUsers();
        } catch {
            setCreateError('通信を確認して、もう一度お試しください');
        } finally {
            setCreating(false);
        }
    };

    const toggleActive = async (target: UserListItem) => {
        const nextState = !target.isActive;
        if (!nextState && !window.confirm(
            `${target.displayName}さんを無効化しますか？\nこのユーザーのログイン中セッションはすべて終了します。`,
        )) return;

        setPendingUserIds((current) => new Set(current).add(target.id));
        setToggleErrors((current) => {
            const next = { ...current };
            delete next[target.id];
            return next;
        });
        try {
            const response = await fetch(`/api/admin/users/${target.id}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: nextState }),
            });
            const data = await response.json().catch(() => null) as { error?: string } | null;
            if (redirectForAuthorization(response.status)) return;
            if (!response.ok) {
                setToggleErrors((current) => ({
                    ...current,
                    [target.id]: data?.error ?? 'ユーザー状態を変更できませんでした',
                }));
                return;
            }
            setUsers((current) => current.map((user) => (
                user.id === target.id ? { ...user, isActive: nextState } : user
            )));
        } catch {
            setToggleErrors((current) => ({
                ...current,
                [target.id]: '通信を確認して、もう一度お試しください',
            }));
        } finally {
            setPendingUserIds((current) => {
                const next = new Set(current);
                next.delete(target.id);
                return next;
            });
        }
    };

    return (
        <>
            <Nav userName={adminUser?.displayName} isAdmin />
            <main id="main-content" className="container">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">Administration</p>
                        <h1 className="page-title">ユーザー管理</h1>
                        <p className="muted">アカウントの作成と利用状態を管理します。</p>
                    </div>
                </div>

                <section className="card" aria-labelledby="create-user-heading">
                    <h2 id="create-user-heading" className="section-title">新規ユーザー作成</h2>
                    <form onSubmit={handleCreate}>
                        <div className="summary-grid">
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
                                    autoComplete="off"
                                    disabled={creating}
                                />
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
                                    autoComplete="off"
                                    disabled={creating}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="password" className="form-label">初期パスワード</label>
                                <input
                                    type="password"
                                    id="password"
                                    className="form-input"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                    minLength={MIN_PASSWORD_LENGTH}
                                    autoComplete="new-password"
                                    disabled={creating}
                                />
                                <p className="form-help">{MIN_PASSWORD_LENGTH}文字以上</p>
                            </div>
                            <div className="form-group">
                                <label htmlFor="passwordConfirmation" className="form-label">初期パスワード（確認）</label>
                                <input
                                    type="password"
                                    id="passwordConfirmation"
                                    className="form-input"
                                    value={passwordConfirmation}
                                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                                    required
                                    minLength={MIN_PASSWORD_LENGTH}
                                    autoComplete="new-password"
                                    disabled={creating}
                                    aria-invalid={Boolean(createError && password !== passwordConfirmation)}
                                />
                            </div>
                        </div>
                        <div aria-live="polite">
                            {createMessage && <p className="success-message">{createMessage}</p>}
                            {createError && <p className="error-message" role="alert">{createError}</p>}
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={creating}>
                            {creating ? '作成中…' : 'ユーザーを作成'}
                        </button>
                    </form>
                </section>

                <section className="card" aria-labelledby="users-heading">
                    <h2 id="users-heading" className="section-title">ユーザー一覧</h2>
                    {loadError && (
                        <div className="alert alert-danger" role="alert">
                            <p>{loadError}</p>
                            <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => void fetchUsers(retryCursor ?? undefined, retryAppend)}
                                disabled={loading || loadingMore}
                            >
                                再試行
                            </button>
                        </div>
                    )}
                    {loading ? (
                        <div className="loading-state" role="status">読み込み中…</div>
                    ) : users.length > 0 ? (
                        <>
                            <div className="table-wrap">
                                <table className="table">
                                    <caption className="visually-hidden">登録ユーザー</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">ログインID</th>
                                            <th scope="col">表示名</th>
                                            <th scope="col">状態</th>
                                            <th scope="col">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((target) => (
                                            <tr key={target.id}>
                                                <td>{target.loginId}</td>
                                                <td>{target.displayName}</td>
                                                <td>
                                                    <span className={`badge ${target.isActive ? 'badge-primary' : 'badge-secondary'}`}>
                                                        {target.isActive ? '有効' : '無効'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="button-row">
                                                        <Link
                                                            href={`/admin/users/${target.id}`}
                                                            className="btn btn-secondary btn-small"
                                                            aria-label={`${target.displayName}さんの詳細を見る`}
                                                        >
                                                            詳細
                                                        </Link>
                                                        {target.role !== 'ADMIN' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => void toggleActive(target)}
                                                                className={`btn ${target.isActive ? 'btn-danger' : 'btn-primary'} btn-small`}
                                                                disabled={pendingUserIds.has(target.id)}
                                                                aria-label={`${target.displayName}さんを${target.isActive ? '無効化' : '有効化'}`}
                                                                aria-describedby={toggleErrors[target.id] ? `toggle-error-${target.id}` : undefined}
                                                            >
                                                                {pendingUserIds.has(target.id) ? '処理中…' : target.isActive ? '無効化' : '有効化'}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {toggleErrors[target.id] && (
                                                        <p
                                                            id={`toggle-error-${target.id}`}
                                                            className="error-message"
                                                            role="alert"
                                                        >
                                                            {toggleErrors[target.id]}
                                                        </p>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {nextCursor && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ marginTop: '1rem' }}
                                    onClick={() => void fetchUsers(nextCursor, true)}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? '読み込み中…' : 'さらに表示'}
                                </button>
                            )}
                        </>
                    ) : !loadError ? (
                        <p className="empty-state">ユーザーがいません。</p>
                    ) : null}
                </section>
            </main>
        </>
    );
}
