'use client';

import { useEffect } from 'react';

export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <main id="main-content" className="auth-shell">
            <div className="card auth-card empty-state" role="alert">
                <p className="eyebrow">Error</p>
                <h1 className="page-title">画面を表示できませんでした</h1>
                <p>一時的な問題の可能性があります。もう一度お試しください。</p>
                <button type="button" className="btn btn-primary" onClick={reset}>再試行</button>
            </div>
        </main>
    );
}
