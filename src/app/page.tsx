import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDisplay, parseDateOnly, todayJST } from '@/lib/date';
import { getCompetitionGoalDisplayValues } from '@/lib/competition-goal-display';
import Nav from '@/components/Nav';

export const metadata: Metadata = { title: 'ホーム' };

function HomeGoalSummary({
  meetName,
  dateText,
  goalText,
}: {
  meetName: string;
  dateText: string;
  goalText: string;
}) {
  return (
    <dl className="goal-display-list goal-display-list-home">
      <div>
        <dt>大会名</dt>
        <dd>{meetName || '未設定'}</dd>
      </div>
      <div>
        <dt>日付</dt>
        <dd>{dateText}</dd>
      </div>
      <div>
        <dt>目標</dt>
        <dd>{goalText || '未設定'}</dd>
      </div>
    </dl>
  );
}

export default async function HomePage() {
  const user = await requireUser();

  const today = todayJST();
  const todayDate = parseDateOnly(today);
  if (!todayDate) throw new Error('Failed to resolve today');

  const [todayLog, latestStory, dailyLogCount, storyVersionCount, competitionGoals] = await Promise.all([
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
    prisma.competitionGoal.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: [{ targetDate: 'asc' }, { updatedAt: 'desc' }],
      select: { type: true, title: true, details: true, targetDate: true },
    }),
  ]);

  const nextMeetGoal = competitionGoals.find((goal) => goal.type === 'NEXT_MEET');
  const annualGoal = competitionGoals.find((goal) => goal.type === 'ANNUAL');
  const nextMilestone = competitionGoals.find((goal) => goal.type === 'MILESTONE');
  const milestoneCount = competitionGoals.filter((goal) => goal.type === 'MILESTONE').length;
  const nextMeetDisplay = nextMeetGoal
    ? getCompetitionGoalDisplayValues(nextMeetGoal)
    : null;
  const annualDisplay = annualGoal
    ? getCompetitionGoalDisplayValues(annualGoal)
    : null;
  const milestoneDisplay = nextMilestone
    ? getCompetitionGoalDisplayValues(nextMilestone)
    : null;

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
            <Link href="/goals" className="btn btn-secondary">大会目標を決める</Link>
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
          <div className="summary-item">
            <p className="summary-label">設定中の大会目標</p>
            <p className="summary-value">{competitionGoals.length}<span className="visually-hidden">件</span></p>
          </div>
        </section>

        <section className="card" aria-labelledby="goals-heading">
          <div className="page-header">
            <div>
              <p className="eyebrow">Competition goals</p>
              <h2 id="goals-heading" className="section-title">大会目標</h2>
              <p className="muted">次の大会から年間の挑戦まで、いま目指していることを確認できます。</p>
            </div>
            <Link href="/goals" className="btn btn-secondary">
              {competitionGoals.length > 0 ? '目標を確認・編集' : '目標を決める'}
            </Link>
          </div>

          {competitionGoals.length > 0 ? (
            <div className="summary-grid">
              <div className="summary-item">
                <p className="summary-label">次の大会</p>
                {nextMeetGoal && nextMeetDisplay ? (
                  <HomeGoalSummary
                    meetName={nextMeetDisplay.meetName}
                    dateText={nextMeetGoal.targetDate ? formatJSTDisplay(nextMeetGoal.targetDate) : '未定'}
                    goalText={nextMeetDisplay.goalText}
                  />
                ) : <p className="muted">まだ設定されていません</p>}
              </div>
              <div className="summary-item">
                <p className="summary-label">年間目標</p>
                {annualGoal && annualDisplay ? (
                  <HomeGoalSummary
                    meetName={annualDisplay.meetName}
                    dateText={annualGoal.targetDate ? `${annualGoal.targetDate.getUTCFullYear()}年` : '未設定'}
                    goalText={annualDisplay.goalText}
                  />
                ) : <p className="muted">まだ設定されていません</p>}
              </div>
              <div className="summary-item">
                <p className="summary-label">期限つき目標</p>
                {nextMilestone && milestoneDisplay ? (
                  <>
                    <HomeGoalSummary
                      meetName={milestoneDisplay.meetName}
                      dateText={nextMilestone.targetDate ? `${formatJSTDisplay(nextMilestone.targetDate)}まで` : '未設定'}
                      goalText={milestoneDisplay.goalText}
                    />
                    {milestoneCount > 1 && <p className="muted goal-more-count">ほか{milestoneCount - 1}件</p>}
                  </>
                ) : <p className="muted">まだ設定されていません</p>}
              </div>
            </div>
          ) : (
            <p className="empty-state">大会名や期限が決まったら、短い言葉から残してみましょう。</p>
          )}
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
