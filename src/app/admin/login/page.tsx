import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import { getCurrentUser } from '@/lib/auth';
import { sanitizeReturnPath } from '@/lib/return-path';

export const metadata: Metadata = { title: '管理者ログイン' };

interface Props {
    searchParams: Promise<{ next?: string | string[] }>;
}

export default async function AdminLoginPage({ searchParams }: Props) {
    const returnTo = sanitizeReturnPath((await searchParams).next, 'admin');
    const user = await getCurrentUser();
    if (user) {
        redirect(user.role === 'ADMIN' ? (returnTo ?? '/admin/users') : '/');
    }

    return <LoginForm adminOnly returnTo={returnTo} />;
}
