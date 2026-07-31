import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: '練習日誌' };

export default async function DailyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const user = await requireUser();
    if (user.role === 'ADMIN') redirect('/admin/users');

    return children;
}
