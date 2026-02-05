'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface NavProps {
    userName?: string;
    isAdmin?: boolean;
}

export default function Nav({ userName, isAdmin }: NavProps) {
    const router = useRouter();

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    return (
        <nav className="nav">
            <div className="nav-content">
                <div className="nav-links">
                    {isAdmin ? (
                        <>
                            <Link href="/admin/users" className="nav-link">ユーザー管理</Link>
                        </>
                    ) : (
                        <>
                            <Link href="/" className="nav-link">ホーム</Link>
                            <Link href="/daily" className="nav-link">日誌</Link>
                            <Link href="/story" className="nav-link">物語</Link>
                            <Link href="/growth" className="nav-link">成長</Link>
                            <Link href="/timeline" className="nav-link">タイムライン</Link>
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {userName && <span style={{ fontSize: '0.875rem' }}>{userName}</span>}
                    <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                        ログアウト
                    </button>
                </div>
            </div>
        </nav>
    );
}
