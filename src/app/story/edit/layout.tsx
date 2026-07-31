import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: '競泳物語を更新' };

export default async function StoryEditLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const user = await requireUser();
    if (user.role === 'ADMIN') redirect('/admin/users');

    return children;
}
