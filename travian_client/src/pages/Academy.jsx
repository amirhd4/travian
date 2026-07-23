import { useState, useEffect, useRef } from 'react';
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

export default function Academy() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    const [data, setData] = useState({ has_academy: false, academy_level: 0, troops: [], active_research: null });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(null);
    const [alertMsg, setAlertMsg] = useState(null);
    const [fetched, setFetched] = useState(false);

    // Fetch data - stable, no re-fetch unless manually triggered
    const fetchData = async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('combat/academy/', { params: { village_id: activeVillageId } });
            setData(data);
        } catch (error) {
            setData({ has_academy: false, academy_level: 0, troops: [], active_research: null });
        } finally {
            setLoading(false);
            setFetched(true);
        }
    };

    // Fetch ONCE on mount - no dependencies that change
    useEffect(() => {
        if (activeVillageId && !fetched) {
            fetchData();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Countdown timer - runs independently
    useEffect(() => {
        const interval = setInterval(() => {
            setData((prev) => {
                if (!prev.active_research) return prev;
                const remaining = Math.max(0, prev.active_research.remaining_seconds - 1);
                if (remaining <= 0) {
                    return { ...prev, active_research: null };
                }
                return { ...prev, active_research: { ...prev.active_research, remaining_seconds: remaining } };
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = () => {
        setLoading(true);
        fetchData();
    };

    const handleResearch = async (troopTypeId) => {
        setSubmitting(troopTypeId);
        try {
            const response = await api.post('combat/academy/', { village_id: activeVillageId, troop_type_id: troopTypeId });
            setAlertMsg({ tone: 'success', text: response.data.message });
            fetchData();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در شروع تحقیق' });
        } finally {
            setSubmitting(null);
        }
    };

    if (loading) return <PageShell><p className="text-center font-bold text-ink-500 mt-10">در حال بارگذاری آکادمی...</p></PageShell>;

    const researchedCount = data.troops.filter((t) => t.is_researched).length;
    const totalCount = data.troops.filter((t) => !t.is_basic).length;

    return (
        <PageShell maxWidth="max-w-3xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="آکادمی" />

            <WoodSign title="آکادمی" icon="🎓">
                {!data.has_academy ? (
                    <p className="text-center text-sm font-bold text-rose-700 py-6">
                        ابتدا باید ساختمان آکادمی را در این دهکده بسازید.
                    </p>
                ) : (
                    <>
                        <p className="text-center text-xs text-ink-600 mb-2 leading-relaxed">
                            سطح آکادمی: <span className="font-bold text-ink-800">{data.academy_level}</span>
                            {' '}— تحقیق‌شده: <span className="font-bold text-green-700">{researchedCount}</span> از <span className="font-bold">{totalCount}</span> نیرو
                        </p>
                        <p className="text-center text-[10px] text-ink-400 mb-4">
                            نیروهای پایه نیازی به تحقیق ندارند. فقط یک تحقیق در هر زمان ممکن است.
                        </p>

                        {data.active_research && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-blue-800">🔍 در حال تحقیق: {data.active_research.troop_name}</p>
                                        <p className="text-xs text-blue-600 mt-1">زمان باقی‌مانده:</p>
                                    </div>
                                    <span className="font-mono font-bold text-blue-700 text-lg" dir="ltr">
                                        {formatDuration(data.active_research.remaining_seconds)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {data.troops.map((t) => (
                                <div key={t.troop_type_id} className={`flex items-center gap-3 rounded-xl p-3 border ${
                                    t.is_researched ? 'bg-green-50/50 border-green-200' : 'bg-white/80 border-parchment-300'
                                }`}>
                                    <img
                                        src={`/assets/troops/unit-${t.troop_type_id}.gif`} alt={t.name}
                                        className={`w-12 h-12 object-contain rounded-lg border flex-shrink-0 ${
                                            t.is_researched ? 'border-green-300 bg-green-50' : 'border-parchment-300 bg-parchment-100 opacity-60'
                                        }`}
                                        onError={(e) => { e.target.style.display='none'; }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-ink-800">{t.name}</p>
                                            {t.is_basic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">پایه</span>}
                                            {t.is_researched && !t.is_basic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">✅ تحقیق شده</span>}
                                            {!t.is_researched && !t.is_basic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">🔒</span>}
                                        </div>
                                        {!t.is_researched && !t.is_basic && t.prereq_error && (
                                            <p className="text-[10px] text-red-500 mt-0.5">{t.prereq_error}</p>
                                        )}
                                        {!t.is_researched && !t.is_basic && t.research_cost && (
                                            <p className="text-[10px] text-ink-500 mt-0.5 flex gap-2 flex-wrap">
                                                <span>🪵 {t.research_cost.wood}</span>
                                                <span>🧱 {t.research_cost.clay}</span>
                                                <span>⚒️ {t.research_cost.iron}</span>
                                                <span>🌾 {t.research_cost.crop}</span>
                                                <span className="text-ink-400">⏱ {formatDuration(t.research_cost.time)}</span>
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-center min-w-[100px] flex-shrink-0">
                                        {t.is_researched || t.is_basic ? (
                                            <span className="text-xs text-green-600 font-bold">آماده آموزش</span>
                                        ) : (
                                            <button
                                                onClick={() => handleResearch(t.troop_type_id)}
                                                disabled={submitting === t.troop_type_id || !t.can_research || !!data.active_research}
                                                className={`text-xs !px-3 !py-1.5 rounded-lg font-bold transition ${
                                                    !t.can_research || !!data.active_research
                                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                        : 'btn-primary'
                                                }`}
                                            >
                                                {submitting === t.troop_type_id ? '...' : 'تحقیق'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </WoodSign>
        </PageShell>
    );
}
