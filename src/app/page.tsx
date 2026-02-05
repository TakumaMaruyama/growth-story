import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { todayJST, formatJSTDisplay, formatJSTDate } from '@/lib/date';
import Nav from '@/components/Nav';

export default async function DashboardPage() {
  const user = await requireUser();

  // Redirect admin to admin dashboard
  if (user.role === 'ADMIN') {
    redirect('/admin/users');
  }

  const today = todayJST();

  // Get today's daily log
  const todayLog = await prisma.dailyLog.findUnique({
    where: {
      userId_logDate: {
        userId: user.id,
        logDate: new Date(today),
      },
    },
  });

  // Get latest story version
  const latestStory = await prisma.storyVersion.findFirst({
    where: { userId: user.id },
    orderBy: { version: 'desc' },
  });

  // Get latest measurement
  const latestMeasurement = await prisma.growthMeasurement.findFirst({
    where: { userId: user.id },
    orderBy: { measuredOn: 'desc' },
  });

  // Get growth profile
  const profile = await prisma.growthProfile.findUnique({
    where: { userId: user.id },
  });

  return (
    <>
      <Nav userName={user.displayName} />
      <div className="container">
        <h1 className="page-title">ダッシュボード</h1>
        <p style={{ marginBottom: '1.5rem' }}>こんにちは、{user.displayName}さん</p>

        {/* Today's Log */}
        <div className="card">
          <h2 className="section-title">📝 今日の日誌</h2>
          {todayLog ? (
            <div>
              <p>点数: <strong>{todayLog.score}</strong>/10</p>
              <p>練習: {todayLog.practiced ? '✅ あり' : '❌ なし'}</p>
              {todayLog.goodText && <p style={{ fontSize: '0.875rem' }}>良かったこと: {todayLog.goodText}</p>}
              <Link href={`/daily?date=${today}`} className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>
                編集する
              </Link>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--secondary)' }}>今日の日誌はまだ書かれていません</p>
              <Link href={`/daily?date=${today}`} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                今日の日誌を書く
              </Link>
            </div>
          )}
        </div>

        {/* Story Summary */}
        <div className="card">
          <h2 className="section-title">📖 私の物語</h2>
          {latestStory ? (
            <div>
              <p>最新バージョン: <strong>Ver.{latestStory.version}</strong></p>
              <p style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>
                作成日: {formatJSTDisplay(latestStory.createdAt)}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Link href="/story" className="btn btn-primary">閲覧する</Link>
                <Link href="/story/edit" className="btn btn-secondary">編集する</Link>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--secondary)' }}>まだ物語が作成されていません</p>
              <Link href="/story/edit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                物語を書く
              </Link>
            </div>
          )}
        </div>

        {/* Growth Summary */}
        <div className="card">
          <h2 className="section-title">📏 成長記録</h2>
          {profile ? (
            <div>
              {latestMeasurement ? (
                <>
                  <p>
                    最新身長: <strong>{latestMeasurement.heightCm} cm</strong>
                    <span style={{ fontSize: '0.875rem', color: 'var(--secondary)', marginLeft: '0.5rem' }}>
                      ({formatJSTDisplay(latestMeasurement.measuredOn)})
                    </span>
                  </p>
                  {latestMeasurement.weightKg && (
                    <p>最新体重: <strong>{latestMeasurement.weightKg} kg</strong></p>
                  )}
                </>
              ) : (
                <p style={{ color: 'var(--secondary)' }}>測定記録がありません</p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <Link href="/growth" className="btn btn-primary">詳細を見る</Link>
                <Link href="/growth/measurements" className="btn btn-secondary">測定を追加</Link>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--secondary)' }}>プロフィールが設定されていません</p>
              <Link href="/growth" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                プロフィールを設定
              </Link>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="card">
          <h2 className="section-title">🔗 クイックリンク</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href="/story/history" className="btn btn-secondary">物語の履歴</Link>
            <Link href="/timeline" className="btn btn-secondary">タイムライン</Link>
          </div>
        </div>
      </div>
    </>
  );
}
