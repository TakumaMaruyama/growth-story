'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GrowthProfileForm() {
    const router = useRouter();
    const [sex, setSex] = useState<'MALE' | 'FEMALE'>('MALE');
    const [birthDate, setBirthDate] = useState('');
    const [fatherHeight, setFatherHeight] = useState('');
    const [motherHeight, setMotherHeight] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const res = await fetch('/api/growth/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sex,
                    birthDate,
                    fatherHeightCm: fatherHeight ? parseFloat(fatherHeight) : null,
                    motherHeightCm: motherHeight ? parseFloat(motherHeight) : null,
                }),
            });

            if (res.ok) {
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || '保存に失敗しました');
            }
        } catch {
            setError('通信エラーが発生しました');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <p style={{ color: 'var(--secondary)', marginBottom: '1rem' }}>
                成長予測を行うにはプロフィールを設定してください
            </p>

            <div className="form-group">
                <label className="form-label">性別</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <input
                            type="radio"
                            name="sex"
                            value="MALE"
                            checked={sex === 'MALE'}
                            onChange={() => setSex('MALE')}
                        />
                        男子
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <input
                            type="radio"
                            name="sex"
                            value="FEMALE"
                            checked={sex === 'FEMALE'}
                            onChange={() => setSex('FEMALE')}
                        />
                        女子
                    </label>
                </div>
            </div>

            <div className="form-group">
                <label htmlFor="birthDate" className="form-label">生年月日</label>
                <input
                    type="date"
                    id="birthDate"
                    className="form-input"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    required
                />
            </div>

            <div className="form-group">
                <label htmlFor="fatherHeight" className="form-label">父の身長 (cm) - 任意</label>
                <input
                    type="number"
                    id="fatherHeight"
                    className="form-input"
                    value={fatherHeight}
                    onChange={(e) => setFatherHeight(e.target.value)}
                    placeholder="例: 175"
                    step="0.1"
                    min="100"
                    max="250"
                />
            </div>

            <div className="form-group">
                <label htmlFor="motherHeight" className="form-label">母の身長 (cm) - 任意</label>
                <input
                    type="number"
                    id="motherHeight"
                    className="form-input"
                    value={motherHeight}
                    onChange={(e) => setMotherHeight(e.target.value)}
                    placeholder="例: 160"
                    step="0.1"
                    min="100"
                    max="250"
                />
            </div>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '保存中...' : 'プロフィールを保存'}
            </button>
        </form>
    );
}
