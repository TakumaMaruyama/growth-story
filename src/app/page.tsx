import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDisplay, parseDateOnly, todayJST } from '@/lib/date';
import Nav from '@/components/Nav';

export const metadata: Metadata = { title: 'ホーム' };

export default async function HomePage() {
  const user = await requireUser();
  if (user.role === 'ADMIN') redirect('/admin/users');

  const today = todayJST();
  const todayDate = parseDateOnly(today);
  if (!todayDate) throw new Error('Failed to resolve today');

  const [todayLog, latestStory, dailyLogCount, storyVersionCount] = await Promise.all([
    prisma.dailyLog.findUnique({
      where: { userId_logDate: { userId: user.id, logDate: todayDate } },
      select: { score: true, practiced: true, goodText: true },
    }),
    prisma.storyVersion.findFirst({
      where: { userId: user.id },
      orderBy: { version: 'desc' },
      select: { version: true, createdAt: true },
    }),
    prisma.dailyLog.count({ where: { userId: user.id } }),
    prisma.storyVersion.count({ where: { userId: user.id } }),
  ]);

  return (
    <>
      <Nav userName={user.displayName} />
      <main id="main-content" className="container">
        <section className="card hero" aria-labelledby="welcome-title">
          <p className="eyebrow">Swim journal</p>
          <h1 id="welcome-title" className="page-title">おかえりなさい、{user.displayName}さん</h1>
          <p className="muted">今日の練習と、これまでの競泳人生を自分の言葉で残していきましょう。</p>
          <div className="button-row">
            <Link href={`/daily?date=${today}`} className="btn btn-primary">
              {todayLog ? '今日の日誌を見直す' : '今日の日誌を書く'}
            </Link>
            <Link href="/story/edit" className="btn btn-secondary">競泳物語を更新する</Link>
          </div>
        </section>

        <section className="summary-grid" aria-label="記録のサマリー">
          <div className="summary-item">
            <p className="summary-label">日誌を残した日</p>
            <p className="summary-value">{dailyLogCount}<span className="visually-hidden">日</span></p>
          </div>
          <div className="summary-item">
            <p className="summary-label">物語の更新</p>
            <p className="summary-value">{storyVersionCount}<span className="visually-hidden">回</span></p>
          </div>
        </section>

        <div className="summary-grid" style={{ marginTop: '1rem' }}>
          <section className="card" aria-labelledby="today-heading">
            <h2 id="today-heading" className="section-title">今日の練習日誌</h2>
            {todayLog ? (
              <div className="stack">
                <div>
                  <p>自己評価 <strong>{todayLog.score}/10</strong></p>
                  <p>練習 {todayLog.practiced ? 'あり' : 'なし'}</p>
                  {todayLog.goodText && <p className="muted">{todayLog.goodText}</p>}
                </div>
                <Link href={`/daily?date=${today}`} className="btn btn-secondary">日誌を開く</Link>
              </div>
            ) : (
              <div className="stack">
                <p className="muted">今日はまだ記録がありません。</p>
                <Link href={`/daily?date=${today}`} className="btn btn-primary">日誌を書く</Link>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="story-heading">
            <h2 id="story-heading" className="section-title">私の競泳物語</h2>
            {latestStory ? (
              <div className="stack">
                <div>
                  <p>最新版 <strong>Ver.{latestStory.version}</strong></p>
                  <p className="muted">更新日 {formatJSTDisplay(latestStory.createdAt)}</p>
                </div>
                <div className="button-row">
                  <Link href="/story" className="btn btn-primary">最新版を見る</Link>
                  <Link href="/story/history" className="btn btn-secondary">履歴を見る</Link>
                </div>
              </div>
            ) : (
              <div className="stack">
                <p className="muted">物語はまだ始まっていません。</p>
                <Link href="/story/edit" className="btn btn-primary">最初の物語を書く</Link>
              </div>
            )}
          </section>
        </div>

        <section className="card" aria-labelledby="review-heading">
          <h2 id="review-heading" className="section-title">これまでを振り返る</h2>
          <p className="muted">日誌と物語の更新を、ひとつの流れで確認できます。</p>
          <Link href="/timeline" className="btn btn-secondary">振り返りを開く</Link>
        </section>
      </main>
    </>
  );
}
