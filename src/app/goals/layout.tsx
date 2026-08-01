import type { Metadata } from 'next';

export const metadata: Metadata = { title: '大会の目標' };

export default function GoalsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return children;
}
