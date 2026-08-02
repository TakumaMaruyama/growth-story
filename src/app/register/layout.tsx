import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '会員登録',
    referrer: 'no-referrer',
};

export default function RegisterLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return children;
}
