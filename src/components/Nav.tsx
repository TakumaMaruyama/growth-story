'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface NavProps {
    userName?: string;
    isAdmin?: boolean;
    beforeLogout?: () => boolean;
}

const USER_LINKS = [
    { href: '/', label: 'ホーム' },
    { href: '/daily', label: '練習日誌' },
    { href: '/story', label: '競泳物語' },
    { href: '/timeline', label: '振り返り' },
] as const;

const ADMIN_LINKS = [{ href: '/admin/users', label: 'ユーザー管理' }] as const;

export default function Nav({ userName, isAdmin = false, beforeLogout }: NavProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const links = isAdmin ? ADMIN_LINKS : USER_LINKS;

    const handleLogout = async () => {
        if (beforeLogout && !beforeLogout()) return;
        setLoggingOut(true);
        setLogoutError('');
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            if (!response.ok) {
                const data = await response.json().catch(() => null) as { error?: string } | null;
                setLogoutError(data?.error ?? 'ログアウトできませんでした');
                return;
            }
            try {
                for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
                    const key = window.sessionStorage.key(index);
                    if (key?.startsWith('swim-story:draft:')) {
                        window.sessionStorage.removeItem(key);
                    }
                }
            } catch {
                // Storage may be unavailable in privacy-restricted browsers.
            }
            router.replace(isAdmin ? '/admin/login' : '/login');
            router.refresh();
        } catch {
            setLogoutError('通信を確認して、もう一度お試しください');
        } finally {
            setLoggingOut(false);
        }
    };

    return (
        <header className="site-header">
            <div className="nav-content">
                <div className="nav-topline">
                    <Link href={isAdmin ? '/admin/users' : '/'} className="brand-link">
                        <span className="brand-mark" aria-hidden="true">S</span>
                        <span>{isAdmin ? '競泳物語 管理' : '私の競泳物語'}</span>
                    </Link>
                    <div className="account-actions">
                        {userName && <span className="user-name">{userName}</span>}
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="btn btn-secondary btn-small"
                            disabled={loggingOut}
                        >
                            {loggingOut ? '処理中…' : 'ログアウト'}
                        </button>
                    </div>
                </div>
                <nav className="nav-links" aria-label="メインナビゲーション">
                    {links.map((link) => {
                        const isCurrent = link.href === '/'
                            ? pathname === '/'
                            : pathname === link.href || pathname.startsWith(`${link.href}/`);
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`nav-link${isCurrent ? ' nav-link-active' : ''}`}
                                aria-current={isCurrent ? 'page' : undefined}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>
                {logoutError && <p className="nav-error" role="alert">{logoutError}</p>}
            </div>
        </header>
    );
}
