'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { use } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';

interface Props {
    params: Promise<{ userId: string }>;
}

interface UserInfo {
    displayName: string;
}

interface TargetUser {
    id: string;
    displayName: string;
}

interface DailyLogItem {
    id: string;
    logDate: string;
    score: number;
    practiced: boolean;
    goodText: string | null;
    improveText: string | null;
    tomorrowText: string | null;
}

export default function AdminUserDailyPage({ params }: Props) {
    const { userId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();

    const [adminUser, setAdminUser] = useState<UserInfo | null>(null);
    const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
    const [logs, setLogs] = useState<DailyLogItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [fromDate, setFromDate] = useState(searchParams.get('from') || '');
    const [toDate, setToDate] = useState(searchParams.get('to') || '');

    useEffect(() => {
        const fetchLogs = async () => {
            const queryParams = new URLSearchParams();
            if (fromDate) queryParams.set('from', fromDate);
            if (toDate) queryParams.set('to', toDate);

            try {
                const res = await fetch(`/api/admin/users/${userId}/daily?${queryParams.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    setAdminUser(data.adminUser);
                    setTargetUser(data.targetUser);
                    setLogs(data.logs);
                } else if (res.status === 401 || res.status === 403) {
                    router.push('/login');
                }
            } catch (error) {
                console.error('Failed to fetch logs', error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [userId, fromDate, toDate, router]);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>{targetUser?.displayName}の日誌一覧</h1>
                    <Link href={`/admin/users/${userId}`} className="btn btn-secondary">ユーザー詳細に戻る</Link>
                </div>

                {/* Date Filter */}
                <div className="card">
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="fromDate" className="form-label">開始日</label>
                            <input
                                type="date"
                                id="fromDate"
                                className="form-input"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="toDate" className="form-label">終了日</label>
                            <input
                                type="date"
                                id="toDate"
                                className="form-input"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => { setFromDate(''); setToDate(''); }}
                        >
                            クリア
                        </button>
                    </div>
                </div>

                {/* Logs List */}
                {logs.length > 0 ? (
                    <div className="card">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>日付</th>
                                    <th>点数</th>
                                    <th>練習</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td>{formatDate(log.logDate)}</td>
                                        <td>{log.score}/10</td>
                                        <td>{log.practiced ? '✅' : '-'}</td>
                                        <td>
                                            <Link href={`/admin/users/${userId}/daily/${log.logDate.split('T')[0]}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                                                詳細
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="card">
                        <p style={{ textAlign: 'center', color: 'var(--secondary)' }}>日誌がありません</p>
                    </div>
                )}
            </div>
        </>
    );
}
