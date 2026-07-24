import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import WoodSign from '../components/WoodSign';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';

export default function Wall() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const [data, setData] = useState({
        wall_name: null, wall_level: 0, base_defense_percent: 0,
        stonemason_level: 0, stonemason_multiplier: 1, total_defense_percent: 0, next_level_defense: null,
    });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('game/wall/', { params: { village_id: activeVillageId } });
            setData(data);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, [activeVillageId]);

    useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

    if (loading) return <PageShell><p className="text-center font-bold text-ink-500 mt-10">در حال بارگذاری...</p></PageShell>;

    if (!data.wall_name) {
        return (
            <PageShell maxWidth="max-w-3xl">
                <WoodSign title="دیوار" icon="🧱">
                    <p className="text-center text-sm text-ink-500 py-6">هیچ دیواری در این دهکده ساخته نشده است.</p>
                </WoodSign>
            </PageShell>
        );
    }

    return (
        <PageShell maxWidth="max-w-3xl">
            <WoodSign title={data.wall_name} icon="🧱">
                <p className="text-xs text-ink-600 mb-4 text-center leading-relaxed">
                    دیوار از دهکده شما در برابر حملات دفاع می‌کند. هر سطح <b>۳٪</b> دفاع اضافه می‌کند.
                    {data.stonemason_level > 0 && (
                        <span className="text-green-700 font-bold"> (سنگ‌تراشی سطح {data.stonemason_level}: ضریب {data.stonemason_multiplier}x)</span>
                    )}
                </p>

                <div className="bg-parchment-50 rounded-xl p-4 border border-parchment-300 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <p className="text-[10px] text-ink-500">سطح دیوار</p>
                            <p className="text-2xl font-bold text-ink-800">{data.wall_level}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-ink-500">دفاع کل</p>
                            <p className="text-2xl font-bold text-green-700">+{data.total_defense_percent}%</p>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
                        <div className="h-3 rounded-full bg-blue-500" style={{ width: `${(data.total_defense_percent / 75) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-ink-400 text-center mt-1">حداکثر ۷۵٪ در سطح ۲۰ با سنگ‌تراشی کامل</p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-parchment-300">
                    <p className="text-xs font-bold text-ink-600 mb-2">📊 جزئیات محاسبه</p>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-ink-500">دفاع پایه (سطح × ۳٪):</span><span className="font-bold">{data.base_defense_percent}%</span></div>
                        <div className="flex justify-between"><span className="text-ink-500">ضریب سنگ‌تراشی:</span><span className="font-bold">×{data.stonemason_multiplier}</span></div>
                        <div className="flex justify-between border-t border-gray-100 pt-1"><span className="text-ink-500 font-bold">دفاع نهایی:</span><span className="font-bold text-green-700">{data.total_defense_percent}%</span></div>
                        {data.next_level_defense !== null && (
                            <div className="flex justify-between"><span className="text-ink-500">سطح بعدی:</span><span className="font-bold text-blue-600">+{data.next_level_defense}%</span></div>
                        )}
                    </div>
                </div>
            </WoodSign>
        </PageShell>
    );
}
