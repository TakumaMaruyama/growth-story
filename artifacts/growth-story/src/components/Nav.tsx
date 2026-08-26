import { Link, useLocation } from 'wouter';
import { useState } from 'react';
import { BookOpen, CalendarDays, Home, PenLine, LogOut, Target } from 'lucide-react';
import { clearTabDrafts } from '../lib/tab-draft-store';

interface NavProps {
    userName?: string;
    isAdmin?: boolean;
    beforeLogout?: () => boolean;
}

const USER_LINKS = [
    { href: '/', label: 'ホーム', Icon: Home },
    { href: '/daily', label: '練習日誌', Icon: PenLine },
    { href: '/goals', label: '大会目標', Icon: Target },
    { href: '/story', label: '競泳物語', Icon: BookOpen },
    { href: '/timeline', label: '記録', Icon: CalendarDays },
] as const;

const ADMIN_LINKS = [{ href: '/admin/users', label: 'ユーザー管理' }] as const;

export default function Nav({ userName, isAdmin = false, beforeLogout }: NavProps) {
    const [location, setLocation] = useLocation();
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const links = isAdmin ? ADMIN_LINKS : USER_LINKS;

    const handleLogout = async () => {
        if (beforeLogout && !beforeLogout()) return;
        setLoggingOut(true);
        setLogoutError('');
        try {
            const response = await fetch('/api/auth/logout', { credentials: 'include', method: 'POST' });
            if (!response.ok) {
                const data = await response.json().catch(() => null) as { error?: string } | null;
                setLogoutError(data?.error ?? 'ログアウトできませんでした');
                return;
            }
            clearTabDrafts();
            setLocation(isAdmin ? '/admin/login' : '/login');
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
                        <span className="brand-mark" aria-hidden="true">
                            <img src="/icons/icon-192.png" alt="" width={32} height={32} />
                        </span>
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
                            {!loggingOut && <LogOut aria-hidden="true" size={18} />}
                            {loggingOut ? '処理中…' : 'ログアウト'}
                        </button>
                    </div>
                </div>
                <nav className="nav-links" aria-label="メインナビゲーション">
                    {links.map((link) => {
                        const isCurrent = link.href === '/'
                            ? location === '/'
                            : location === link.href || location.startsWith(`${link.href}/`);
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

            {!isAdmin && (
                <nav className="mobile-bottom-nav" aria-label="モバイルナビゲーション">
                    {USER_LINKS.map((link) => {
                        const isCurrent = link.href === '/'
                            ? location === '/'
                            : location === link.href || location.startsWith(`${link.href}/`);
                        const Icon = link.Icon;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`mobile-bottom-link${isCurrent ? ' mobile-bottom-link-active' : ''}`}
                                aria-current={isCurrent ? 'page' : undefined}
                            >
                                <Icon aria-hidden="true" size={24} />
                                <span>{link.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            )}
        </header>
    );
}