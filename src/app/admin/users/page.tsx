'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { loginHref } from '@/lib/return-path';

interface UserInfo {
    displayName: string;
}

interface UserListItem {
    id: string;
    loginId: string;
    displayName: string;
    role: 'USER' | 'ADMIN';
    isActive: boolean;
    membershipStatus: 'ACTIVE' | 'WITHDRAWN';
    withdrawnAt: string | null;
    createdAt: string;
}

interface UserPage {
    adminUser: UserInfo;
    users: UserListItem[];
    nextCursor: string | null;
    error?: string;
}

interface RegistrationLinkResponse {
    fragment?: string;
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

    const [registrationUrl, setRegistrationUrl] = useState('');
    const [registrationLinkLoading, setRegistrationLinkLoading] = useState(true);
    const [registrationLinkError, setRegistrationLinkError] = useState('');
    const [copyMessage, setCopyMessage] = useState('');

    const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(() => new Set());
    const [toggleErrors, setToggleErrors] = useState<Record<string, string>>({});

    const redirectForAuthorization = useCallback((status: number) => {
        if (status === 401) {
            router.replace(loginHref(`${window.location.pathname}${window.location.search}`, 'admin'));
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

    const fetchRegistrationLink = useCallback(async () => {
        setRegistrationLinkLoading(true);
        setRegistrationLinkError('');
        try {
            const response = await fetch('/api/admin/registration-link', { cache: 'no-store' });
            const data = await response.json().catch(() => null) as RegistrationLinkResponse | null;
            if (redirectForAuthorization(response.status)) return;
            if (!response.ok || typeof data?.fragment !== 'string') {
                setRegistrationLinkError(data?.error ?? '共通登録URLを読み込めませんでした');
                return;
            }
            setRegistrationUrl(`${window.location.origin}/register#${data.fragment}`);
        } catch {
            setRegistrationLinkError('通信を確認して、共通登録URLを再読み込みしてください');
        } finally {
            setRegistrationLinkLoading(false);
        }
    }, [redirectForAuthorization]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void fetchUsers();
            void fetchRegistrationLink();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [fetchRegistrationLink, fetchUsers]);

    const copyRegistrationUrl = async () => {
        try {
            await navigator.clipboard.writeText(registrationUrl);
            setCopyMessage('共通登録URLをコピーしました');
        } catch {
            setCopyMessage('URL欄を選択してコピーしてください');
        }
    };

    const runUserAction = async (
        target: UserListItem,
        url: string,
        body: Record<string, unknown>,
        apply: (current: UserListItem) => UserListItem,
    ) => {
        setPendingUserIds((current) => new Set(current).add(target.id));
        setToggleErrors((current) => {
            const next = { ...current };
            delete next[target.id];
            return next;
        });
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
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
            setUsers((current) => current.map((user) => user.id === target.id ? apply(user) : user));
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

    const toggleMembership = async (target: UserListItem) => {
        const nextStatus = target.membershipStatus === 'ACTIVE' ? 'WITHDRAWN' : 'ACTIVE';
        const confirmed = nextStatus === 'WITHDRAWN'
            ? window.confirm(
                `${target.displayName}さんを退会にしますか？\n過去の記録は閲覧できますが、新規入力と更新ができなくなります。`,
            )
            : window.confirm(
                `${target.displayName}さんの利用を再開しますか？\n保護者の利用再開の意思を確認してから実行してください。`,
            );
        if (!confirmed) return;

        await runUserAction(
            target,
            `/api/admin/users/${target.id}/membership`,
            { membershipStatus: nextStatus },
            (user) => ({
                ...user,
                membershipStatus: nextStatus,
                withdrawnAt: nextStatus === 'WITHDRAWN' ? new Date().toISOString() : null,
            }),
        );
    };

    const toggleActive = async (target: UserListItem) => {
        const nextState = !target.isActive;
        if (!nextState && !window.confirm(
            `${target.displayName}さんのログインを停止しますか？\nログイン中のセッションはすべて終了します。`,
        )) return;

        await runUserAction(
            target,
            `/api/admin/users/${target.id}/toggle`,
            { isActive: nextState },
            (user) => ({ ...user, isActive: nextState }),
        );
    };

    return (
        <>
            <Nav userName={adminUser?.displayName} isAdmin />
            <main id="main-content" className="container">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">Administration</p>
                        <h1 className="page-title">会員管理</h1>
                        <p className="muted">保護者へ送る共通登録URLと、会員の利用状態を管理します。</p>
                    </div>
                </div>

                <section className="card" aria-labelledby="registration-link-heading">
                    <h2 id="registration-link-heading" className="section-title">共通の会員登録URL</h2>
                    <p className="muted">
                        このURLは全選手共通で、何人でも登録できます。管理者から案内を受けた保護者だけに送ってください。
                    </p>
                    <div className="alert alert-info">
                        <p>選手名は登録時に保護者が入力します。選手ごとのURL発行は不要です。</p>
                        <p>登録済み・退会済みの選手は同じ名前で再登録できません。利用再開は会員一覧から行ってください。</p>
                        <p className="muted">URLが意図せず共有された場合は、Replitの `REGISTRATION_ACCESS_TOKEN` を更新して再公開すると、以前のURLを一括で無効にできます。</p>
                    </div>
                    {registrationLinkError && (
                        <div className="alert alert-danger" role="alert">
                            <p>{registrationLinkError}</p>
                            <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => void fetchRegistrationLink()}
                                disabled={registrationLinkLoading}
                            >
                                再試行
                            </button>
                        </div>
                    )}
                    {registrationLinkLoading ? (
                        <div className="loading-state" role="status">共通登録URLを読み込んでいます…</div>
                    ) : registrationUrl ? (
                        <div className="form-group">
                            <label htmlFor="registrationUrl" className="form-label">保護者へ送るURL</label>
                            <input
                                id="registrationUrl"
                                className="form-input"
                                value={registrationUrl}
                                readOnly
                                onFocus={(event) => event.currentTarget.select()}
                            />
                            <div className="button-row" style={{ marginTop: '0.75rem' }}>
                                <button type="button" className="btn btn-primary" onClick={() => void copyRegistrationUrl()}>
                                    共通URLをコピー
                                </button>
                                {copyMessage && <span role="status">{copyMessage}</span>}
                            </div>
                        </div>
                    ) : null}
                </section>

                <section className="card" aria-labelledby="users-heading">
                    <h2 id="users-heading" className="section-title">会員一覧</h2>
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
                                    <caption className="visually-hidden">登録会員</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">ログインID</th>
                                            <th scope="col">表示名</th>
                                            <th scope="col">会員状態</th>
                                            <th scope="col">ログイン</th>
                                            <th scope="col">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((target) => (
                                            <tr key={target.id}>
                                                <td>{target.loginId}</td>
                                                <td>{target.displayName}</td>
                                                <td>
                                                    <span className={`badge ${target.membershipStatus === 'ACTIVE' ? 'badge-primary' : 'badge-secondary'}`}>
                                                        {target.membershipStatus === 'ACTIVE' ? '利用中' : '退会'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${target.isActive ? 'badge-primary' : 'badge-secondary'}`}>
                                                        {target.isActive ? '可能' : '停止'}
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
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void toggleMembership(target)}
                                                                    className={`btn ${target.membershipStatus === 'ACTIVE' ? 'btn-danger' : 'btn-primary'} btn-small`}
                                                                    disabled={pendingUserIds.has(target.id)}
                                                                >
                                                                    {pendingUserIds.has(target.id)
                                                                        ? '処理中…'
                                                                        : target.membershipStatus === 'ACTIVE' ? '退会' : '利用再開'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void toggleActive(target)}
                                                                    className="btn btn-secondary btn-small"
                                                                    disabled={pendingUserIds.has(target.id)}
                                                                >
                                                                    {target.isActive ? 'ログイン停止' : '停止解除'}
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                    {toggleErrors[target.id] && (
                                                        <p className="error-message" role="alert">{toggleErrors[target.id]}</p>
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
                        <p className="empty-state">会員がいません。</p>
                    ) : null}
                </section>
            </main>
        </>
    );
}
