import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatJSTDisplay } from '@/lib/date';
import Nav from '@/components/Nav';

interface TimelineItem {
    date: Date;
    type: 'story' | 'measurement';
    description: string;
}

export default async function TimelinePage() {
    const user = await requireUser();

    if (user.role === 'ADMIN') {
        redirect('/admin/users');
    }

    // Get story versions
    const storyVersions = await prisma.storyVersion.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
    });

    // Get measurements
    const measurements = await prisma.growthMeasurement.findMany({
        where: { userId: user.id },
        orderBy: { measuredOn: 'desc' },
    });

    // Combine into timeline
    const timeline: TimelineItem[] = [
        ...storyVersions.map((v) => ({
            date: v.createdAt,
            type: 'story' as const,
            description: `物語 Ver.${v.version}${v.note ? ` - ${v.note}` : ''}`,
        })),
        ...measurements.map((m) => ({
            date: m.measuredOn,
            type: 'measurement' as const,
            description: `身長 ${m.heightCm} cm${m.weightKg ? ` / 体重 ${m.weightKg} kg` : ''}`,
        })),
    ];

    // Sort by date descending
    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
        <>
            <Nav userName={user.displayName} />
            <div className="container">
                <h1 className="page-title">タイムライン</h1>

                {timeline.length > 0 ? (
                    <div className="card">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>日付</th>
                                    <th>種類</th>
                                    <th>内容</th>
                                </tr>
                            </thead>
                            <tbody>
                                {timeline.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>{formatJSTDisplay(item.date)}</td>
                                        <td>
                                            <span className={`badge ${item.type === 'story' ? 'badge-primary' : 'badge-secondary'}`}>
                                                {item.type === 'story' ? '📖 物語' : '📏 測定'}
                                            </span>
                                        </td>
                                        <td>{item.description}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="card">
                        <p style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                            まだ記録がありません
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
