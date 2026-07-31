import type { Metadata } from 'next';

export const metadata: Metadata = { title: '競泳物語を更新' };

export default function StoryEditLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return children;
}
