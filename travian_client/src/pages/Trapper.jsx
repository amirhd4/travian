import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import WoodSign from '../components/WoodSign';
import { AlertModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';

function formatDuration(totalSeconds) {
    if (totalSeconds <= 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

const RESOURCE_IMAGES = {
    wood: '/assets/ui/res-1.gif',
    clay: '/assets/ui/res-2.gif',
    iron: '/assets/ui/res-3.gif',
    crop: '/assets/ui/res-4.gif',
};

export default function Trapper() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { resources } = useGameStore();

    const [data, setData] = useState({
        trapper_level: 0, max_traps: 0, trapped_count: 0, available_traps: 0,
        trapped_troops: [], trap_cost: {}, queue: [],
    });
    const [loading, setLoading] = useState(true);
    const [alertMsg, setAlertMsg] = useState(null);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const fetchData = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('combat/trapper/', { params: { village_id: activeVillageId } });
            setData(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

    const handleRelease = async (entryId) => {
        try {
            const { data } = await api.post(`combat/trapped-troops/${entryId}/release/`);
            setAlertMsg({ tone: 'success', text: data.message });
            fetchData();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در آزادسازی' });
        }
    };

    if (loading) return <PageShell><p className="text-center font-bold text-ink-500 mt-10">در حال بارگذاری تله‌ساز...</p></PageShell>;

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="تله‌ساز" />

            <WoodSign title="تله‌ساز" icon="🪤">
                <p className="text-xs text-ink-600 mb-4 leading-relaxed text-center">
                    تله‌ها از دهکده شما در برابر مهاجمان محافظت می‌کنند. هر سطح <b>{15}</b> تله ظرفیت ایجاد می‌کند.
                </p>

                {/* Trap Capacity */}
                <div className="bg-parchment-50 rounded-xl p-4 border border-parchment-300 mb-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-[10px] text-ink-500">سطح تله‌ساز</p>
                            <p className="text-lg font-bold text-ink-800">{data.trapper_level}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-ink-500">ظرفیت کل</p>
                            <p className="text-lg font-bold text-ink-800">{data.max_traps}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-ink-500">تله موجود</p>
                            <p className="text-lg font-bold text-green-700">{data.available_traps}</p>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                        <div className="h-2 rounded-full bg-amber-500 transition-all" style={{ width: `${data.max_traps > 0 ? (data.trapped_count / data.max_traps) * 100 : 0}%` }} />
                    </div>
                    <p className="text-[10px] text-ink-400 text-center mt-1">{data.trapped_count}/{data.max_traps} تله اشغال شده</p>
                </div>

                {/* Trapped Troops */}
                {data.trapped_troops.length > 0 ? (
                    <div className="mb-4">
                        <p className="text-xs font-bold text-ink-600 mb-2">نیروهای اسیر:</p>
                        <div className="space-y-2">
                            {data.trapped_troops.map((t) => (
                                <div key={t.id} className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-200">
                                    <div>
                                        <p className="text-xs font-bold text-red-800">{t.troop_name} × {t.count}</p>
                                        <p className="text-[10px] text-red-600">مالک: {t.original_owner}</p>
                                    </div>
                                    <button onClick={() => handleRelease(t.id)} className="text-[10px] px-2 py-1 bg-green-600 text-white rounded font-bold hover:bg-green-700">
                                        آزادسازی
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-xs text-ink-400 py-4">هیچ نیروی اسیری وجود ندارد.</p>
                )}

                {/* Training Queue */}
                {data.queue.length > 0 && (
                    <div className="mt-4 border-t border-gray-200 pt-4">
                        <p className="text-xs font-bold text-ink-600 mb-2">صف آموزش تله:</p>
                        {data.queue.map((q) => (
                            <div key={q.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100">
                                <span>تله × {q.count}</span>
                                <span className="font-mono text-blue-700" dir="ltr">{formatDuration(q.remaining_seconds)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Trap Cost Info */}
                {data.trap_cost && data.trap_cost.wood > 0 && (
                    <div className="mt-4 border-t border-gray-200 pt-4">
                        <p className="text-xs font-bold text-ink-600 mb-2">هزینه هر تله:</p>
                        <div className="flex gap-3 text-[10px] font-bold">
                            {Object.entries(data.trap_cost).map(([res, amount]) => (
                                <span key={res} className="flex items-center gap-0.5">
                                    <img src={RESOURCE_IMAGES[res]} alt="" className="w-3 h-3" />
                                    {amount}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </WoodSign>
        </PageShell>
    );
}
