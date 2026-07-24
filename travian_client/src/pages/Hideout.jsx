import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import WoodSign from '../components/WoodSign';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';

const RESOURCE_IMAGES = {
    wood: '/assets/ui/res-1.gif',
    clay: '/assets/ui/res-2.gif',
    iron: '/assets/ui/res-3.gif',
    crop: '/assets/ui/res-4.gif',
};

const TRIBE_NAMES = { ROMAN: 'رومی', TEUTON: 'توتن', GAUL: 'گل' };

export default function Hideout() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { resources } = useGameStore();

    const [data, setData] = useState({
        total_level: 0, total_capacity: 0, individual_capacity_per_level: 100,
        tribe: 'ROMAN', tribe_multiplier: 1, crannies: [],
    });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('game/cranny/', { params: { village_id: activeVillageId } });
            setData(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

    if (loading) return <PageShell><p className="text-center font-bold text-ink-500 mt-10">در حال بارگذاری مخفیگاه...</p></PageShell>;

    return (
        <PageShell maxWidth="max-w-3xl">
            <WoodSign title="مخفیگاه" icon="🕳️">
                <p className="text-xs text-ink-600 mb-4 leading-relaxed text-center">
                    مخفیگاه منابع شما را از چشم دشمان پنهان می‌کند. هر سطح <b>{data.individual_capacity_per_level}</b> واحد از هر نوع منبع را محافظت می‌کند.
                    {data.tribe_multiplier > 1 && (
                        <span className="text-amber-600 font-bold"> ({TRIBE_NAMES[data.tribe]}: ظرفیت ۲ برابر!)</span>
                    )}
                </p>

                {/* Total Capacity */}
                <div className="bg-parchment-50 rounded-xl p-4 border border-parchment-300 mb-4 text-center">
                    <p className="text-xs text-ink-500 mb-1">ظرفیت کل مخفیگاه</p>
                    <p className="text-2xl font-bold text-ink-800">{data.total_capacity.toLocaleString()}</p>
                    <p className="text-[10px] text-ink-400 mt-1">واحد از هر نوع منبع (چوب، خاک رس، آهن، گندم)</p>
                </div>

                {/* Current Resources vs Protection */}
                <div className="mb-4">
                    <p className="text-xs font-bold text-ink-600 mb-2">وضعیت محافظت منابع فعلی:</p>
                    {['wood', 'clay', 'iron', 'crop'].map((res) => {
                        const protected_ = Math.min(resources[res] || 0, data.total_capacity);
                        const exposed = Math.max(0, (resources[res] || 0) - data.total_capacity);
                        const percent = Math.min(100, ((resources[res] || 0) / (data.total_capacity || 1)) * 100);
                        return (
                            <div key={res} className="mb-2">
                                <div className="flex items-center justify-between text-[10px] mb-0.5">
                                    <span className="flex items-center gap-1">
                                        <img src={RESOURCE_IMAGES[res]} alt="" className="w-3 h-3" />
                                        <span className="font-bold">{res === 'wood' ? 'چوب' : res === 'clay' ? 'خاک رس' : res === 'iron' ? 'آهن' : 'گندم'}</span>
                                    </span>
                                    <span>
                                        <span className="text-green-700 font-bold">{protected_.toLocaleString()}</span>
                                        {exposed > 0 && <span className="text-red-500 mr-1"> (+{exposed.toLocaleString()} در معرض غارت)</span>}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: percent > 100 ? '#DE0000' : '#228B22' }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Individual Crannies */}
                {data.crannies.length > 0 ? (
                    <div>
                        <p className="text-xs font-bold text-ink-600 mb-2">مخفیگاه‌های ساختمانی:</p>
                        <div className="space-y-2">
                            {data.crannies.map((c) => (
                                <div key={c.position} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100">
                                    <div>
                                        <span className="text-xs font-bold text-ink-700">موقعیت {c.position}</span>
                                        <span className="text-[10px] text-ink-400 mr-2">سطح {c.level}</span>
                                    </div>
                                    <div className="text-left">
                                        <span className="text-xs font-bold text-ink-800">{c.capacity.toLocaleString()}</span>
                                        {c.next_capacity && (
                                            <span className="text-[10px] text-green-600 mr-1">→ {c.next_capacity.toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-xs text-ink-400 py-4">هیچ مخفیگاهی ساخته نشده است.</p>
                )}
            </WoodSign>
        </PageShell>
    );
}
