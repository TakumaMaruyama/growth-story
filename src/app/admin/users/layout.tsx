import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'ユーザー管理' };

export default function AdminUsersLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return children;
}
