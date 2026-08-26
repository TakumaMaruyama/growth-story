import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'パスワード再設定' };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
    return children;
}
