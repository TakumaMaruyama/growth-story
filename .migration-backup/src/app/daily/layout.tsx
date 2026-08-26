import type { Metadata } from 'next';

export const metadata: Metadata = { title: '練習日誌' };

export default function DailyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return children;
}
