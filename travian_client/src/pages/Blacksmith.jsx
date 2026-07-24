import { useState, useEffect, useCallback } from 'react';
import PageShell from '../components/PageShell';
import WoodSign from '../components/WoodSign';
import { AlertModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';
import { getUnitImage } from '../constants/images';

function formatDuration(totalSeconds) {
    if (totalSeconds <= 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function Blacksmith() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    const [data, setData] = useState({ has_blacksmith: true, blacksmith_level: 0, troops: [] });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [alertMsg, setAlertMsg] = useState(null);

    const fetchData = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('combat/blacksmith/', { params: { village_id: activeVillageId } });
            setData(data);
            setErrorMsg('');
        } catch (error) {
            setData({ has_blacksmith: false, blacksmith_level: 0, troops: [] });
            setErrorMsg(error.response?.data?.error || 'خطا در دریافت اطلاعات آهنگری');
        } finally {
            setLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

    useEffect(() => {
        let needsRefresh = false;
        const ticker = setInterval(() => {
            setData((prev) => {
                let expired = false;
                const troops = prev.troops.map((t) => {
                    if (!t.is_upgrading || !t.upgrade_ends_at) return t;
                    const remaining = Math.max(0, Math.round((new Date(t.upgrade_ends_at).getTime() - Date.now()) / 1000));
                    if (remaining <= 0 && (t._remaining === undefined || t._remaining > 0)) expired = true;
                    return { ...t, _remaining: remaining };
                });
                if (expired) needsRefresh = true;
                return { ...prev, troops };
            });
        }, 1000);
        const refresher = setInterval(() => {
            if (needsRefresh) { needsRefresh = false; fetchData(); }
        }, 2000);
        return () => { clearInterval(ticker); clearInterval(refresher); };
    }, [fetchData]);

    useEffect(() => {
        const interval = setInterval(fetchData, 20000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleUpgrade = async (troopTypeId) => {
        setSubmitting(troopTypeId);
        try {
            const response = await api.post('combat/blacksmith/', { village_id: activeVillageId, troop_type_id: troopTypeId });
            setAlertMsg({ tone: 'success', text: response.data.message });
            fetchData();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در شروع ارتقا' });
        } finally {
            setSubmitting(null);
        }
    };

    if (loading) return <PageShell><p className="text-center font-bold text-ink-500 mt-10">در حال بارگذاری آهنگری...</p></PageShell>;

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="آهنگری" />

            <WoodSign title="آهنگری" icon="🔨">
                {!data.has_blacksmith ? (
                    <p className="text-center text-sm font-bold text-rose-700 py-6">
                        {errorMsg || 'ابتدا باید ساختمان آهنگری را در این دهکده بسازید.'}
                    </p>
                ) : (
                    <>
                        <p className="text-center text-xs text-ink-600 mb-4 leading-relaxed">
                            سطح آهنگری این دهکده: <span className="font-bold text-ink-800">{data.blacksmith_level}</span><br />
                            هر لول ارتقای یک نوع نیرو، قدرت حمله و دفاع همان نیرو را — وقتی از این دهکده اعزام شود یا در آن مستقر باشد — به میزان ۲٪ افزایش می‌دهد (حداکثر ۲۰ لول).
                        </p>

                        <div className="space-y-3">
                            {data.troops.map((t) => {
                                const remaining = t._remaining ?? Math.max(0, Math.round((new Date(t.upgrade_ends_at).getTime() - Date.now()) / 1000));
                                const isMax = t.level >= t.max_level;
                                const canUpgrade = t.is_researched || t.is_basic;

                                return (
                                    <div key={t.troop_type_id} className={`flex items-center gap-4 rounded-xl p-3 ${
                                        canUpgrade ? 'bg-white/80 border border-parchment-300' : 'bg-gray-50 border border-gray-200 opacity-70'
                                    }`}>
                                        <img
                                            src={getUnitImage(t.troop_type_id)} alt={t.name}
                                            className={`w-14 h-14 object-contain rounded-lg border flex-shrink-0 ${
                                                canUpgrade ? 'bg-parchment-100 border-parchment-300' : 'bg-gray-100 border-gray-200 grayscale'
                                            }`}
                                            onError={(e) => { e.target.style.display='none'; }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-ink-800">{t.name}</p>
                                                {t.is_basic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">پایه</span>}
                                                {t.is_researched && !t.is_basic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">✅</span>}
                                                {!canUpgrade && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">🔒</span>}
                                            </div>
                                            <p className="text-xs text-ink-500">سطح فعلی: {t.level} از {t.max_level}</p>
                                            {!isMax && t.next_level_cost && canUpgrade && (
                                                <p className="text-[10px] text-ink-600 mt-1 flex gap-3 flex-wrap">
                                                    <span>🪵 {t.next_level_cost.wood}</span>
                                                    <span>🧱 {t.next_level_cost.clay}</span>
                                                    <span>⚒️ {t.next_level_cost.iron}</span>
                                                    <span>🌾 {t.next_level_cost.crop}</span>
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-center min-w-[140px] flex-shrink-0">
                                            {!canUpgrade ? (
                                                <span className="text-xs text-red-500 font-bold">🔒 تحقیق نشده</span>
                                            ) : isMax ? (
                                                <span className="badge-green">🏆 حداکثر لول</span>
                                            ) : t.is_upgrading && remaining > 0 ? (
                                                <span className="font-mono font-bold text-blue-700 text-sm" dir="ltr">{formatDuration(remaining)}</span>
                                            ) : (
                                                <button onClick={() => handleUpgrade(t.troop_type_id)} disabled={submitting === t.troop_type_id} className="btn-primary text-xs !px-4 !py-2">
                                                    {submitting === t.troop_type_id ? '...' : `ارتقا به لول ${t.level + 1}`}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </WoodSign>
        </PageShell>
    );
}