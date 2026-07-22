import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import useGameStore from '../store/useGameStore';
import { formatDuration } from '../utils/formatter';

function unitIcon(unit) {
    if (unit.is_settler) return '🧑‍🌾';
    if (unit.is_scout) return '🔍';
    if (unit.is_siege_weapon) return '🎯';
    if (unit.is_cavalry) return '🐎';
    if (unit.defense_cavalry > unit.defense_infantry) return '🛡️';
    return '🚷';
}

export default function Barracks() {
    const { resources } = useGameStore();
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { lastMessage } = useGameWebSocket();

    const [catalog, setCatalog] = useState([]);
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [trainQty, setTrainQty] = useState({});
    const [submitting, setSubmitting] = useState(null);

    const [trappedTroops, setTrappedTroops] = useState([]);
    const [releasingId, setReleasingId] = useState(null);

    const fetchTrapped = useCallback(async () => {
        try {
            const { data } = await api.get('combat/trapped-troops/');
            setTrappedTroops(data);
        } catch (error) { console.error(error); }
    }, []);

    useEffect(() => { fetchTrapped(); }, [fetchTrapped]);

    const handleRelease = async (id) => {
        setReleasingId(id);
        try {
            const { data } = await api.post(`combat/trapped-troops/${id}/release/`);
            alert(data.message);
            fetchTrapped();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در آزادسازی نیرو');
        } finally {
            setReleasingId(null);
        }
    };

    const fetchCatalog = useCallback(async () => {
        try {
            const params = activeVillageId ? { village_id: activeVillageId } : {};
            const { data } = await api.get('combat/troop-types/', { params });
            setCatalog(data);
        } catch (error) { console.error(error); }
    }, [activeVillageId]);

    const fetchQueue = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('combat/barracks/queue/', { params: { village_id: activeVillageId } });
            setQueue(data);
        } catch (error) { console.error(error); }
    }, [activeVillageId]);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchCatalog(), fetchQueue()]).finally(() => setLoading(false));
    }, [fetchCatalog, fetchQueue]);

    useEffect(() => {
        if (lastMessage?.type === 'TROOP_TRAINING_COMPLETED') fetchQueue();
    }, [lastMessage, fetchQueue]);

    useEffect(() => {
        const interval = setInterval(() => {
            setQueue((prev) => prev.map((item) => ({ ...item, remaining_seconds: Math.max(0, item.remaining_seconds - 1) })));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(fetchQueue, 20000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    const calculateMaxPossible = (costs) => Math.floor(Math.min(
        resources.wood / (costs.wood || 1), resources.clay / (costs.clay || 1),
        resources.iron / (costs.iron || 1), resources.crop / (costs.crop || 1)
    ));

    const handleTrain = async (unit) => {
        const quantity = trainQty[unit.id] || 0;
        if (quantity <= 0) return;
        if (!activeVillageId) return;
        setSubmitting(unit.id);
        try {
            const response = await api.post('combat/barracks/train/', {
                village_id: activeVillageId, troop_type: unit.id, quantity,
            });
            setTrainQty((prev) => ({ ...prev, [unit.id]: 0 }));
            fetchQueue();
        } catch (error) {
            alert(error.response?.data?.error || 'ارتباط با سرور برقرار نشد');
        } finally {
            setSubmitting(null);
        }
    };

    if (loading) return <PageShell><LoadingState label="در حال بارگذاری پادگان..." /></PageShell>;

    return (
        <PageShell maxWidth="max-w-4xl">
            <div className="panel">
                <div className="panel-header">
                    <span className="panel-title">⚔️ پادگان</span>
                </div>
                <div className="panel-body">
                    <p className="text-ink-500 text-xs mb-5">
                        هر نیرویی که آموزش دهید بلافاصله وارد صف می‌شود و پس از اتمام زمان آموزش به‌طور خودکار به نیروهای دهکده اضافه می‌شود.
                    </p>

                    <div className="space-y-3">
                        {catalog.map((unit) => {
                            const maxUnits = calculateMaxPossible(unit.costs);
                            const quantity = trainQty[unit.id] || 0;
                            const canTrain = unit.is_researched || unit.is_basic;

                            return (
                                <div key={unit.id} className={`rounded-xl border p-4 flex flex-col md:flex-row gap-4 items-center ${
                                    canTrain ? 'border-parchment-300 bg-parchment-50' : 'border-gray-200 bg-gray-50 opacity-70'
                                }`}>
                                    <div className="w-16 h-16 rounded-xl bg-white border border-parchment-300 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        <img src={`/assets/troops/unit-${unit.id}.gif`} alt={unit.name} className={`w-full h-full object-contain ${!canTrain ? 'grayscale' : ''}`} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                                        <div className="w-full h-full items-center justify-center text-3xl hidden">{unitIcon(unit)}</div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-ink-800">{unit.name}</h3>
                                        <p className="text-[11px] text-ink-500 mt-0.5">
                                            حمله {unit.attack_power} · دفاع پیاده {unit.defense_infantry} · دفاع سواره {unit.defense_cavalry} · هر واحد {formatDuration(unit.base_train_time)}
                                        </p>
                                        <div className="flex gap-1.5 mt-1 flex-wrap">
                                            <span className="badge-gold">🏗️ {unit.required_building}</span>
                                            {unit.required_academy_level > 0 && (
                                                <span className="badge-gold">🎓 آکادمی سطح {unit.required_academy_level}</span>
                                            )}
                                            {unit.is_basic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">پایه</span>}
                                            {unit.is_researched && !unit.is_basic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">✅</span>}
                                            {!canTrain && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">🔒 تحقیق نشده</span>}
                                        </div>
                                        <div className="flex gap-3 mt-2 text-[11px] font-bold text-ink-600">
                                            <span>🪵 {unit.costs.wood}</span>
                                            <span>🧱 {unit.costs.clay}</span>
                                            <span>⚒️ {unit.costs.iron}</span>
                                            <span>🌾 {unit.costs.crop}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 w-full md:w-auto bg-white p-3 rounded-xl border border-parchment-300">
                                        {canTrain ? (
                                            <>
                                                <div className="flex flex-col items-center">
                                                    <input
                                                        type="number" min="0" max={maxUnits}
                                                        value={quantity || ''}
                                                        onChange={(e) => setTrainQty((prev) => ({ ...prev, [unit.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                                                        className="field w-20 text-center font-bold"
                                                        placeholder="تعداد"
                                                    />
                                                    <button
                                                        onClick={() => setTrainQty((prev) => ({ ...prev, [unit.id]: maxUnits }))}
                                                        className="text-[10px] text-brand-600 hover:underline mt-1 font-bold"
                                                    >
                                                        حداکثر: {maxUnits}
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => handleTrain(unit)}
                                                    disabled={submitting === unit.id || quantity <= 0 || !activeVillageId}
                                                    className="btn-gold whitespace-nowrap"
                                                >
                                                    {submitting === unit.id ? '...' : 'آموزش'}
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-xs text-red-500 font-bold">🔒 ابتدا در آکادمی تحقیق کنید</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="panel">
                <div className="panel-header"><span className="panel-title">⏳ صف آموزش فعلی</span></div>
                <div className="panel-body">
                    {queue.length === 0 ? (
                        <EmptyState icon="🏋️" title="در حال حاضر هیچ نیرویی در حال آموزش نیست." />
                    ) : (
                        <div className="space-y-2">
                            {queue.map((item) => (
                                <div key={item.id} className="flex items-center justify-between border border-brand-200 bg-brand-50 rounded-lg p-3">
                                    <span className="font-bold text-sm text-ink-800">{item.count}x {item.troop_name}</span>
                                    <span className="font-mono font-bold text-brand-700" dir="ltr">{formatDuration(item.remaining_seconds)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {trappedTroops.length > 0 && (
                <div className="panel">
                    <div className="panel-header"><span className="panel-title">🪤 نیروهای اسیرشده در تله</span></div>
                    <div className="panel-body space-y-2">
                        {trappedTroops.map((t) => (
                            <div key={t.id} className="flex items-center justify-between border border-parchment-300 bg-parchment-50 rounded-lg p-3">
                                <div>
                                    <p className="font-bold text-sm text-ink-800">{t.count}x {t.troop_name}</p>
                                    <p className="text-xs text-ink-500">مالک اصلی: {t.original_owner} · دهکده‌ی تله: {t.trapper_village_name}</p>
                                </div>
                                <button onClick={() => handleRelease(t.id)} disabled={releasingId === t.id} className="btn-ghost text-xs !px-3 !py-1.5">
                                    {releasingId === t.id ? '...' : '🕊️ آزادسازی'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </PageShell>
    );
}