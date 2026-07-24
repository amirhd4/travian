import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import WoodSign from '../components/WoodSign';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';

export default function Stonemason() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const [data, setData] = useState({ level: 0, current_bonus_percent: 0, next_bonus_percent: null, wall_level: 0, wall_defense_percent: 0 });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('game/stonemason/', { params: { village_id: activeVillageId } });
            setData(data);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, [activeVillageId]);

    useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

    if (loading) return <PageShell><p className="text-center font-bold text-ink-500 mt-10">در حال بارگذاری...</p></PageShell>;

    return (
        <PageShell maxWidth="max-w-3xl">
            <WoodSign title="کارگاه سنگ‌تراشی" icon="🔨">
                <p className="text-xs text-ink-600 mb-4 text-center leading-relaxed">
                    سنگ‌تراشان استحکام دیوار دهکده شما را افزایش می‌دهند. هر سطح <b>۲٪</b> پایداری بیشتر به دیوار می‌دهد.
                </p>

                <div className="bg-parchment-50 rounded-xl p-4 border border-parchment-300 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <p className="text-[10px] text-ink-500">سطح فعلی</p>
                            <p className="text-2xl font-bold text-ink-800">{data.level}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-ink-500">پایداری دیوار</p>
                            <p className="text-2xl font-bold text-green-700">+{data.current_bonus_percent}%</p>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
                        <div className="h-3 rounded-full bg-green-500" style={{ width: `${(data.current_bonus_percent / 40) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-ink-400 text-center mt-1">حداکثر ۴۰٪ در سطح ۲۰</p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-parchment-300">
                    <p className="text-xs font-bold text-ink-600 mb-2">🧱 تعامل با دیوار</p>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-ink-500">سطح دیوار:</span><span className="font-bold">{data.wall_level}</span></div>
                        <div className="flex justify-between"><span className="text-ink-500">دفاع کل دیوار:</span><span className="font-bold text-green-700">{data.wall_defense_percent}%</span></div>
                        {data.next_bonus_percent !== null && (
                            <div className="flex justify-between"><span className="text-ink-500">سطح بعدی:</span><span className="font-bold text-blue-600">+{data.next_bonus_percent}%</span></div>
                        )}
                    </div>
                </div>
            </WoodSign>
        </PageShell>
    );
}
