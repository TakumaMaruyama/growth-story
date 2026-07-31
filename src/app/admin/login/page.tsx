import type { Metadata } from 'next';
import LoginForm from '@/components/LoginForm';

export const metadata: Metadata = { title: '管理者ログイン' };

export default function AdminLoginPage() {
    return <LoginForm adminOnly />;
}
