import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Target } from 'lucide-react';
import Nav from '../components/Nav';
import { loginHref } from '../lib/return-path';
import { formatJSTDisplay } from '../lib/date';
import { sortCompetitionGoalsForDisplay, getCompetitionGoalDisplayValues } from '../lib/competition-goal-display';

const GOAL_TYPE_LABELS = {
    NEXT_MEET: '大会',
    ANNUAL: '年間',
    MILESTONE: '出場目標',
} as const;

export default function AdminUserGoals({ params }: { params: { userId: string } }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [, setLocation] = useLocation();

    useEffect(() => {
        const loadGoals = async () => {
            try {
                const response = await fetch(`/api/admin/users/${params.userId}/goals`, { credentials: 'include' });
                if (response.status === 401) {
                    setLocation(loginHref('/admin/users', 'admin'));
                    return;
                }
                if (response.status === 403 || response.status === 404) {
                    setLocation('/admin/users');
                    return;
                }
                if (!response.ok) {
                    throw new Error('Failed to load goals');
                }
                const json = await response.json();
                
                if (json.goals) {
                    json.goals = json.goals.map((g: any) => ({
                        ...g,
                        targetDate: g.targetDate ? new Date(g.targetDate) : null,
                        updatedAt: g.updatedAt ? new Date(g.updatedAt) : null,
                    }));
                }
                
                setData(json);
            } catch (err) {
                setError('データの読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };
        loadGoals();
    }, [params.userId, setLocation]);

    if (loading) {
        return <><Nav isAdmin /><main className="container"><div className="loading-state">読み込み中...</div></main></>;
    }
    if (error || !data) {
        return <><Nav isAdmin /><main className="container"><div className="alert alert-danger">{error}</div></main></>;
    }

    const { targetUser, goals } = data;
    const sortedGoals = sortCompetitionGoalsForDisplay(goals, new Date().toISOString().split('T')[0]);

    return (
        <>
            <Nav isAdmin />
            <main id="main-content" className="container">
                <header className="page-header">
                    <div>
                        <p className="eyebrow">{targetUser.displayName} さんの記録</p>
                        <h1 className="page-title">大会目標</h1>
                    </div>
                    <div className="button-row">
                        <Link href={`/admin/users/${targetUser.id}`} className="btn btn-secondary">
                            ユーザー詳細へ戻る
                        </Link>
                    </div>
                </header>

                <div className="card">
                    {sortedGoals.length > 0 ? (
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th scope="col">種別</th>
                                        <th scope="col">大会名</th>
                                        <th scope="col">日付</th>
                                        <th scope="col">目標</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedGoals.map((goal: any) => {
                                        const displayGoal = getCompetitionGoalDisplayValues(goal);
                                        const dateText = goal.targetDate
                                            ? goal.type === 'ANNUAL'
                                                ? `${goal.targetDate.getUTCFullYear()}年`
                                                : `${formatJSTDisplay(goal.targetDate)}${goal.type === 'MILESTONE' ? 'まで' : ''}`
                                            : '未定';
                                        
                                        return (
                                            <tr key={goal.id}>
                                                <td><span className="badge badge-secondary">{GOAL_TYPE_LABELS[goal.type as keyof typeof GOAL_TYPE_LABELS]}</span></td>
                                                <td>{displayGoal.meetName || '未設定'}</td>
                                                <td>{dateText}</td>
                                                <td>{displayGoal.goalText || '未設定'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <Target aria-hidden="true" size={34} />
                            <p>大会目標は設定されていません。</p>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}