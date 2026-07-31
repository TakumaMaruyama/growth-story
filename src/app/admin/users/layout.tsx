import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'ユーザー管理' };

export default async function AdminUsersLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    await requireAdmin();
    return children;
}
