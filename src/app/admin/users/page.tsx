'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';

interface UserInfo {
    displayName: string;
}

interface UserListItem {
    id: string;
    loginId: string;
    displayName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

export default function AdminUsersPage() {
    const router = useRouter();
    const [adminUser, setAdminUser] = useState<UserInfo | null>(null);
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Create user form
    const [loginId, setLoginId] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [creating, setCreating] = useState(false);
    const [createMessage, setCreateMessage] = useState('');
    const [createError, setCreateError] = useState('');

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setAdminUser(data.adminUser);
                setUsers(data.users);
            } else if (res.status === 401 || res.status === 403) {
                router.push('/login');
            }
        } catch {
            setError('データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setCreateError('');
        setCreateMessage('');

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loginId, displayName, password }),
            });

            if (res.ok) {
                setCreateMessage('ユーザーを作成しました');
                setLoginId('');
                setDisplayName('');
                setPassword('');
                fetchUsers();
            } else {
                const data = await res.json();
                setCreateError(data.error || '作成に失敗しました');
            }
        } catch {
            setCreateError('通信エラーが発生しました');
        } finally {
            setCreating(false);
        }
    };

    const toggleActive = async (userId: string, isActive: boolean) => {
        try {
            const res = await fetch(`/api/admin/users/${userId}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive }),
            });

            if (res.ok) {
                fetchUsers();
            }
        } catch {
            console.error('Toggle failed');
        }
    };

    if (loading) {
        return (
            <>
                <Nav userName={adminUser?.displayName} isAdmin />
                <div className="container">
                    <p>読み込み中...</p>
                </div>
            </>
        );
    }

    return (
        <>
            <Nav userName={adminUser?.displayName} isAdmin />
            <div className="container">
                <h1 className="page-title">ユーザー管理</h1>

                {error && <p className="error-message">{error}</p>}

                {/* Create User Form */}
                <div className="card">
                    <h2 className="section-title">新規ユーザー作成</h2>
                    <form onSubmit={handleCreate}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="loginId" className="form-label">ログインID</label>
                                <input
                                    type="text"
                                    id="loginId"
                                    className="form-input"
                                    value={loginId}
                                    onChange={(e) => setLoginId(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="displayName" className="form-label">表示名</label>
                                <input
                                    type="text"
                                    id="displayName"
                                    className="form-input"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="password" className="form-label">初期パスワード</label>
                                <input
                                    type="password"
                                    id="password"
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>
                        {createMessage && <p className="success-message" style={{ marginTop: '0.5rem' }}>{createMessage}</p>}
                        {createError && <p className="error-message" style={{ marginTop: '0.5rem' }}>{createError}</p>}
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={creating}>
                            {creating ? '作成中...' : 'ユーザーを作成'}
                        </button>
                    </form>
                </div>

                {/* Users List */}
                <div className="card">
                    <h2 className="section-title">ユーザー一覧</h2>
                    {users.length > 0 ? (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>ログインID</th>
                                    <th>表示名</th>
                                    <th>状態</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td>{u.loginId}</td>
                                        <td>{u.displayName}</td>
                                        <td>
                                            <span className={`badge ${u.isActive ? 'badge-primary' : 'badge-secondary'}`}>
                                                {u.isActive ? '有効' : '無効'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                <Link href={`/admin/users/${u.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                                                    詳細
                                                </Link>
                                                {u.role !== 'ADMIN' && (
                                                    <button
                                                        onClick={() => toggleActive(u.id, u.isActive)}
                                                        className={`btn ${u.isActive ? 'btn-danger' : 'btn-primary'}`}
                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                    >
                                                        {u.isActive ? '無効化' : '有効化'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p style={{ color: 'var(--secondary)' }}>ユーザーがいません</p>
                    )}
                </div>
            </div>
        </>
    );
}
