import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDisplay, parseDateOnly, todayJST } from '@/lib/date';
import {
  findNextMeetGoalId,
  getCompetitionGoalDisplayValues,
  sortCompetitionGoalsForDisplay,
} from '@/lib/competition-goal-display';
import { getDailyActivityLabel } from '@/lib/daily-activity';
import Nav from '@/components/Nav';

export const metadata: Metadata = { title: 'ホーム' };

const GOAL_TYPE_LABELS = {
  NEXT_MEET: '大会',
  ANNUAL: '年間',
  MILESTONE: '出場目標',
} as const;

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
      select: { score: true, activityType: true, goodText: true },
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
      orderBy: { updatedAt: 'desc' },
      select: { id: true, type: true, title: true, details: true, targetDate: true, updatedAt: true },
    }),
  ]);

  const sortedCompetitionGoals = sortCompetitionGoalsForDisplay(competitionGoals, today);
  const displayedCompetitionGoals = sortedCompetitionGoals.slice(0, 3);
  const remainingGoalCount = competitionGoals.length - displayedCompetitionGoals.length;
  const nextMeetGoalId = findNextMeetGoalId(sortedCompetitionGoals, today);
  const isReadOnly = user.membershipStatus === 'WITHDRAWN';

  return (
    <>
      <Nav userName={user.displayName} />
      <main id="main-content" className="container">
        {isReadOnly && (
          <div className="alert alert-warning" role="status">
            <strong>退会中のため、記録は閲覧のみです。</strong>
            <p>新規入力や更新はできません。利用再開は管理者へご連絡ください。</p>
          </div>
        )}
        <section className="card hero" aria-labelledby="welcome-title">
          <p className="eyebrow">Swim journal</p>
          <h1 id="welcome-title" className="page-title">おかえりなさい、{user.displayName}さん</h1>
          <p className="muted">今日の練習日誌も、大会への目標も、これまでの競泳人生も、自分の言葉で残していきましょう。</p>
          <div className="button-row">
            <Link href={`/daily?date=${today}`} className="btn btn-primary">
              {isReadOnly ? '日誌を見る' : todayLog ? '今日の日誌を見直す' : '今日の日誌を書く'}
            </Link>
            <Link href={isReadOnly ? '/goals' : '/goals?add=1'} className="btn btn-secondary">
              {isReadOnly ? '大会目標を見る' : '大会目標を追加'}
            </Link>
            <Link href={isReadOnly ? '/story' : '/story/edit'} className="btn btn-secondary">
              {isReadOnly ? '競泳物語を見る' : '競泳物語を更新する'}
            </Link>
          </div>
        </section>

        <section className="summary-grid" aria-label="記録のサマリー">
          <div className="summary-item">
            <p className="summary-label">練習日誌の記録</p>
            <p className="summary-value">{dailyLogCount}<span className="visually-hidden">日</span></p>
          </div>
          <div className="summary-item">
            <p className="summary-label">設定中の大会目標</p>
            <p className="summary-value">{competitionGoals.length}<span className="visually-hidden">件</span></p>
          </div>
          <div className="summary-item">
            <p className="summary-label">競泳物語の更新</p>
            <p className="summary-value">{storyVersionCount}<span className="visually-hidden">回</span></p>
          </div>
        </section>

        <section className="card" aria-labelledby="today-heading">
          <h2 id="today-heading" className="section-title">今日の練習日誌</h2>
          {todayLog ? (
            <div className="stack">
              <div>
                <p>自己評価 <strong>{todayLog.score}/10</strong></p>
                <p>区分 {getDailyActivityLabel(todayLog.activityType)}</p>
                {todayLog.goodText && <p className="muted">{todayLog.goodText}</p>}
              </div>
              <Link href={`/daily?date=${today}`} className="btn btn-secondary">日誌を開く</Link>
            </div>
          ) : (
            <div className="stack">
              <p className="muted">今日はまだ記録がありません。</p>
              {!isReadOnly && <Link href={`/daily?date=${today}`} className="btn btn-primary">日誌を書く</Link>}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="goals-heading">
          <div className="page-header">
            <div>
              <p className="eyebrow">Competition goals</p>
              <h2 id="goals-heading" className="section-title">大会目標</h2>
              <p className="muted">大会・年間・出場目標を、日付の近い順に確認できます。</p>
            </div>
            <div className="button-row">
              {!isReadOnly && <Link href="/goals?add=1" className="btn btn-primary">目標を追加</Link>}
              <Link href="/goals" className="btn btn-secondary">すべて見る</Link>
            </div>
          </div>

          {competitionGoals.length > 0 ? (
            <div className="goals-milestone-list">
              {displayedCompetitionGoals.map((goal) => {
                const displayGoal = getCompetitionGoalDisplayValues(goal);
                const dateText = goal.targetDate
                  ? goal.type === 'ANNUAL'
                    ? `${goal.targetDate.getUTCFullYear()}年`
                    : `${formatJSTDisplay(goal.targetDate)}${goal.type === 'MILESTONE' ? 'まで' : ''}`
                  : '未定';

                return (
                  <article key={goal.id} className="summary-item">
                    <div className="goal-list-badges">
                      <span className="badge badge-secondary">{GOAL_TYPE_LABELS[goal.type]}</span>
                      {goal.id === nextMeetGoalId && (
                        <span className="badge badge-primary">次の大会</span>
                      )}
                    </div>
                    <HomeGoalSummary
                      meetName={displayGoal.meetName}
                      dateText={dateText}
                      goalText={displayGoal.goalText}
                    />
                  </article>
                );
              })}
              {remainingGoalCount > 0 && (
                <Link href="/goals" className="muted goal-more-count">ほか{remainingGoalCount}件を見る</Link>
              )}
            </div>
          ) : (
            <p className="empty-state">大会名や期限が決まったら、短い言葉から残してみましょう。</p>
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
              {!isReadOnly && <Link href="/story/edit" className="btn btn-primary">最初の物語を書く</Link>}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="records-heading">
          <h2 id="records-heading" className="section-title">これまでの記録</h2>
          <p className="muted">日誌、大会目標、競泳物語を、カレンダーと一覧で確認できます。</p>
          <Link href="/timeline" className="btn btn-secondary">記録を開く</Link>
        </section>
      </main>
    </>
  );
}
