import Link from 'next/link';

export default function NotFound() {
    return (
        <main id="main-content" className="auth-shell">
            <div className="card auth-card empty-state">
                <p className="eyebrow">404</p>
                <h1 className="page-title">ページが見つかりません</h1>
                <p>URLが変わったか、ページが削除された可能性があります。</p>
                <Link href="/" className="btn btn-primary">ホームへ戻る</Link>
            </div>
        </main>
    );
}
