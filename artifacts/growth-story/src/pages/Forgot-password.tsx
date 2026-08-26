
import { Link } from 'wouter';



export default function ForgotPasswordPage() {
    return (
        <main id="main-content" className="auth-shell">
            <div className="auth-card">
                <div className="auth-brand">
                    <span className="brand-mark" aria-hidden="true">S</span>
                    <p className="eyebrow" style={{ marginTop: '0.75rem' }}>Password help</p>
                    <h1 className="page-title">パスワードを忘れた方</h1>
                    <p className="muted">保護者から管理者へご連絡ください。</p>
                </div>

                <div className="card">
                    <div className="alert alert-info">
                        <p>管理者が本人と保護者を確認したあと、パスワード再設定用URLをご案内します。</p>
                        <p>再設定URLは発行から2日間有効で、1回だけ使用できます。</p>
                        <p>過去の記録を引き継ぐため、新規会員登録はしないでください。</p>
                    </div>
                    <div className="auth-links">
                        <Link href="/login">ログインへ戻る</Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
