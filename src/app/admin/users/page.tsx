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

interface InviteListItem {
    id: string;
    athleteName: string;
    expiresAt: string;
    usedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    usedBy: { displayName: string } | null;
}

interface InvitePage {
    invites?: InviteListItem[];
    error?: string;
}

function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function inviteStatus(invite: InviteListItem, now: number): {
    label: string;
    className: string;
    canRevoke: boolean;
} {
    if (invite.usedAt) return { label: '登録済み', className: 'badge-primary', canRevoke: false };
    if (invite.revokedAt) return { label: '停止済み', className: 'badge-secondary', canRevoke: false };
    if (new Date(invite.expiresAt).getTime() <= now) {
        return { label: '期限切れ', className: 'badge-secondary', canRevoke: false };
    }
    return { label: '利用可能', className: 'badge-primary', canRevoke: true };
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

    const [invites, setInvites] = useState<InviteListItem[]>([]);
    const [inviteStatusTime, setInviteStatusTime] = useState(0);
    const [invitesLoading, setInvitesLoading] = useState(true);
    const [inviteListError, setInviteListError] = useState('');
    const [athleteName, setAthleteName] = useState('');
    const [creatingInvite, setCreatingInvite] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [newInviteUrl, setNewInviteUrl] = useState('');
    const [copyMessage, setCopyMessage] = useState('');
    const [pendingInviteIds, setPendingInviteIds] = useState<Set<string>>(() => new Set());

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

    const fetchInvites = useCallback(async () => {
        setInvitesLoading(true);
        setInviteListError('');
        try {
            const response = await fetch('/api/admin/registration-invites', { cache: 'no-store' });
            const data = await response.json().catch(() => null) as InvitePage | null;
            if (redirectForAuthorization(response.status)) return;
            if (!response.ok || !Array.isArray(data?.invites)) {
                setInviteListError(data?.error ?? '登録URLの一覧を読み込めませんでした');
                return;
            }
            setInvites(data.invites);
            setInviteStatusTime(Date.now());
        } catch {
            setInviteListError('通信を確認して、登録URLを再読み込みしてください');
        } finally {
            setInvitesLoading(false);
        }
    }, [redirectForAuthorization]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void fetchUsers();
            void fetchInvites();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [fetchInvites, fetchUsers]);

    const handleCreateInvite = async (event: React.FormEvent) => {
        event.preventDefault();
        setInviteError('');
        setNewInviteUrl('');
        setCopyMessage('');
        setCreatingInvite(true);
        try {
            const response = await fetch('/api/admin/registration-invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ athleteName }),
            });
            const data = await response.json().catch(() => null) as {
                token?: string;
                error?: string;
            } | null;
            if (redirectForAuthorization(response.status)) return;
            if (!response.ok || typeof data?.token !== 'string') {
                setInviteError(data?.error ?? '登録URLを発行できませんでした');
                return;
            }
            setNewInviteUrl(`${window.location.origin}/register?invite=${encodeURIComponent(data.token)}`);
            setAthleteName('');
            await fetchInvites();
        } catch {
            setInviteError('通信を確認して、もう一度お試しください');
        } finally {
            setCreatingInvite(false);
        }
    };

    const copyInviteUrl = async () => {
        try {
            await navigator.clipboard.writeText(newInviteUrl);
            setCopyMessage('登録URLをコピーしました');
        } catch {
            setCopyMessage('URL欄を選択してコピーしてください');
        }
    };

    const revokeInvite = async (invite: InviteListItem) => {
        if (!window.confirm(`${invite.athleteName}さんの登録URLを停止しますか？`)) return;
        setPendingInviteIds((current) => new Set(current).add(invite.id));
        setInviteListError('');
        try {
            const response = await fetch(`/api/admin/registration-invites/${invite.id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => null) as { error?: string } | null;
            if (redirectForAuthorization(response.status)) return;
            if (!response.ok) {
                setInviteListError(data?.error ?? '登録URLを停止できませんでした');
                return;
            }
            await fetchInvites();
        } catch {
            setInviteListError('通信を確認して、もう一度お試しください');
        } finally {
            setPendingInviteIds((current) => {
                const next = new Set(current);
                next.delete(invite.id);
                return next;
            });
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
                        <p className="muted">保護者へ送る登録URLと、会員の利用状態を管理します。</p>
                    </div>
                </div>

                <section className="card" aria-labelledby="create-invite-heading">
                    <h2 id="create-invite-heading" className="section-title">会員登録URLを発行</h2>
                    <p className="muted">URLは1選手につき1回だけ利用でき、発行から7日で期限切れになります。</p>
                    <form onSubmit={handleCreateInvite}>
                        <div className="form-group">
                            <label htmlFor="athleteName" className="form-label">選手名</label>
                            <input
                                type="text"
                                id="athleteName"
                                className="form-input"
                                value={athleteName}
                                onChange={(event) => setAthleteName(event.target.value)}
                                required
                                maxLength={80}
                                disabled={creatingInvite}
                            />
                        </div>
                        {inviteError && <p className="error-message" role="alert">{inviteError}</p>}
                        <button type="submit" className="btn btn-primary" disabled={creatingInvite}>
                            {creatingInvite ? '発行中…' : '登録URLを発行'}
                        </button>
                    </form>

                    {newInviteUrl && (
                        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                            <p><strong>このURLを保護者へ送ってください。</strong></p>
                            <p className="muted">安全のため、同じURLはこの画面を離れると再表示できません。</p>
                            <label htmlFor="newInviteUrl" className="form-label">登録URL</label>
                            <input
                                id="newInviteUrl"
                                className="form-input"
                                value={newInviteUrl}
                                readOnly
                                onFocus={(event) => event.currentTarget.select()}
                            />
                            <div className="button-row" style={{ marginTop: '0.75rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => void copyInviteUrl()}>
                                    URLをコピー
                                </button>
                                {copyMessage && <span role="status">{copyMessage}</span>}
                            </div>
                        </div>
                    )}
                </section>

                <section className="card" aria-labelledby="invites-heading">
                    <h2 id="invites-heading" className="section-title">発行済み登録URL</h2>
                    {inviteListError && <p className="error-message" role="alert">{inviteListError}</p>}
                    {invitesLoading ? (
                        <div className="loading-state" role="status">読み込み中…</div>
                    ) : invites.length > 0 ? (
                        <div className="table-wrap">
                            <table className="table">
                                <caption className="visually-hidden">発行済み登録URL</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">選手名</th>
                                        <th scope="col">状態</th>
                                        <th scope="col">期限・登録者</th>
                                        <th scope="col">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invites.map((invite) => {
                                        const status = inviteStatus(invite, inviteStatusTime);
                                        return (
                                            <tr key={invite.id}>
                                                <td>{invite.athleteName}</td>
                                                <td><span className={`badge ${status.className}`}>{status.label}</span></td>
                                                <td>
                                                    {invite.usedBy
                                                        ? `${invite.usedBy.displayName}さんが登録`
                                                        : `${formatDateTime(invite.expiresAt)}まで`}
                                                </td>
                                                <td>
                                                    {status.canRevoke ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-danger btn-small"
                                                            onClick={() => void revokeInvite(invite)}
                                                            disabled={pendingInviteIds.has(invite.id)}
                                                        >
                                                            {pendingInviteIds.has(invite.id) ? '停止中…' : 'URLを停止'}
                                                        </button>
                                                    ) : <span className="muted">操作なし</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="empty-state">発行済みの登録URLはありません。</p>
                    )}
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
