'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import { getDailyActivityLabel, type DailyActivityType } from '@/lib/daily-activity';
import { loginHref } from '@/lib/return-path';

interface Props {
    params: Promise<{ userId: string }>;
}

interface UserInfo {
    displayName: string;
}

interface DailyLogItem {
    id: string;
    logDate: string;
    score: number;
    activityType: DailyActivityType;
}

export default function AdminUserDailyPage({ params }: Props) {
    const { userId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';

    const [adminUser, setAdminUser] = useState<UserInfo | null>(null);
    const [targetUser, setTargetUser] = useState<UserInfo | null>(null);
    const [logs, setLogs] = useState<DailyLogItem[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [filterError, setFilterError] = useState('');
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        const fetchLogs = async () => {
            setLoading(true);
            setLoadError('');
            setTruncated(false);
            const query = new URLSearchParams();
            if (from) query.set('from', from);
            if (to) query.set('to', to);

            try {
                const response = await fetch(`/api/admin/users/${userId}/daily?${query}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => null) as {
                    error?: string;
                    adminUser?: UserInfo;
                    targetUser?: UserInfo;
                    logs?: DailyLogItem[];
                    truncated?: boolean;
                } | null;
                if (response.status === 401) {
                    router.replace(loginHref(`${window.location.pathname}${window.location.search}`, 'admin'));
                    return;
                }
                if (response.status === 403) {
                    router.replace('/');
                    return;
                }
                if (!response.ok || !data?.adminUser || !data.targetUser || !data.logs) {
                    setLoadError(data?.error ?? '日誌一覧を読み込めませんでした');
                    return;
                }
                setAdminUser(data.adminUser);
                setTargetUser(data.targetUser);
                setLogs(data.logs);
                setTruncated(Boolean(data.truncated));
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
                setLoadError('通信を確認して、もう一度お試しください');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void fetchLogs();
        return () => controller.abort();
    }, [from, retryKey, router, to, userId]);

    const applyFilter = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const fromDate = String(formData.get('from') ?? '');
        const toDate = String(formData.get('to') ?? '');
        if (fromDate && toDate && fromDate > toDate) {
            setFilterError('開始日は終了日以前にしてください');
            return;
        }
        setFilterError('');
        const query = new URLSearchParams();
        if (fromDate) query.set('from', fromDate);
        if (toDate) query.set('to', toDate);
        router.replace(`/admin/users/${userId}/daily${query.size ? `?${query}` : ''}`);
    };

    const clearFilter = () => {
        setFilterError('');
        router.replace(`/admin/users/${userId}/daily`);
    };

    const formatDate = (value: string) => new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        dateStyle: 'long',
    }).format(new Date(value));

    return (
        <>
            <Nav userName={adminUser?.displayName} isAdmin />
            <main id="main-content" className="container">
                <div className="page-header">
                    <div>
                        <p className="eyebrow">Daily logs</p>
                        <h1 className="page-title">{targetUser?.displayName ?? 'ユーザー'}の日誌</h1>
                    </div>
                    <Link href={`/admin/users/${userId}`} className="btn btn-secondary">ユーザー詳細に戻る</Link>
                </div>

                <section className="card" aria-labelledby="filter-heading">
                    <h2 id="filter-heading" className="section-title">期間を絞り込む</h2>
                    <form key={`${from}:${to}`} onSubmit={applyFilter}>
                        <div className="button-row" style={{ alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="fromDate" className="form-label">開始日</label>
                                <input
                                    type="date"
                                    id="fromDate"
                                    name="from"
                                    className="form-input"
                                    defaultValue={from}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="toDate" className="form-label">終了日</label>
                                <input
                                    type="date"
                                    id="toDate"
                                    name="to"
                                    className="form-input"
                                    defaultValue={to}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary">絞り込む</button>
                            <button type="button" className="btn btn-secondary" onClick={clearFilter}>クリア</button>
                        </div>
                    </form>
                    {filterError && <p className="error-message" role="alert">{filterError}</p>}
                </section>

                {truncated && <div className="alert alert-warning">最新200件を表示しています。期間を指定して絞り込んでください。</div>}

                <section className="card" aria-labelledby="logs-heading">
                    <h2 id="logs-heading" className="section-title">日誌一覧</h2>
                    {loadError && (
                        <div className="alert alert-danger" role="alert">
                            <p>{loadError}</p>
                            <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => setRetryKey((current) => current + 1)}
                                disabled={loading}
                            >
                                再試行
                            </button>
                        </div>
                    )}
                    {loading ? (
                        <div className="loading-state" role="status">読み込み中…</div>
                    ) : loadError ? null : logs.length > 0 ? (
                        <div className="table-wrap">
                            <table className="table">
                                <caption className="visually-hidden">{targetUser?.displayName}さんの日誌</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">日付</th>
                                        <th scope="col">自己評価</th>
                                        <th scope="col">区分</th>
                                        <th scope="col">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id}>
                                            <td>{formatDate(log.logDate)}</td>
                                            <td>{log.score}/10</td>
                                            <td>{getDailyActivityLabel(log.activityType)}</td>
                                            <td>
                                                <Link
                                                    href={`/admin/users/${userId}/daily/${log.logDate.slice(0, 10)}`}
                                                    className="btn btn-secondary btn-small"
                                                    aria-label={`${formatDate(log.logDate)}の日誌を見る`}
                                                >
                                                    詳細
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="empty-state">該当する日誌はありません。</p>
                    )}
                </section>
            </main>
        </>
    );
}
