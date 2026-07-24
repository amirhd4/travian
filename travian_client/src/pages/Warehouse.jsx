import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import WoodSign from '../components/WoodSign';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return '∞';
    if (seconds <= 0) return 'پر شد';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}روز ${h}ساعت`;
    if (h > 0) return `${h}ساعت ${m}دقیقه`;
    return `${m} دقیقه`;
}

const RESOURCE_CONFIG = {
    wood: { label: 'چوب', img: '/assets/ui/res-1.gif', color: '#8B6914' },
    clay: { label: 'خاک رس', img: '/assets/ui/res-2.gif', color: '#CD853F' },
    iron: { label: 'آهن', img: '/assets/ui/res-3.gif', color: '#666' },
    crop: { label: 'گندم', img: '/assets/ui/res-4.gif', color: '#DAA520' },
};

export default function Warehouse() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    const [data, setData] = useState({ warehouse_level: 0, granary_level: 0, resources: {} });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('game/warehouse/', { params: { village_id: activeVillageId } });
            setData(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);
    useEffect(() => { const i = setInterval(fetchData, 15000); return () => clearInterval(i); }, [fetchData]);

    if (loading) return <PageShell><p className="text-center font-bold text-ink-500 mt-10">در حال بارگذاری...</p></PageShell>;

    return (
        <PageShell maxWidth="max-w-3xl">
            <WoodSign title="انبار و سیلو" icon="📦">
                <p className="text-xs text-ink-600 mb-4 text-center">
                    انبار سطح <b>{data.warehouse_level}</b> · سیلو سطح <b>{data.granary_level}</b>
                </p>

                <div className="space-y-3">
                    {Object.entries(data.resources).map(([key, res]) => {
                        const cfg = RESOURCE_CONFIG[key];
                        const percent = Math.min(100, (res.current / (res.max || 1)) * 100);
                        const barColor = percent > 90 ? '#DE0000' : percent > 70 ? '#F88C1F' : cfg.color;
                        return (
                            <div key={key} className="bg-white rounded-xl p-3 border border-parchment-300">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-ink-800">
                                        <img src={cfg.img} alt="" className="w-4 h-4" />
                                        {cfg.label}
                                    </span>
                                    <span className="text-xs font-bold">{res.current.toLocaleString()} / {res.max.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                    <div className="h-2 rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: barColor }} />
                                </div>
                                <div className="flex justify-between text-[10px] text-ink-500">
                                    <span>تولید: {res.production > 0 ? '+' : ''}{Math.round(res.production).toLocaleString()}/ساعت</span>
                                    <span>{formatDuration(res.time_until_full)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </WoodSign>
        </PageShell>
    );
}
