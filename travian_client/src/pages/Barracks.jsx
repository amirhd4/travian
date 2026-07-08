import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import useGameStore from '../store/useGameStore';

function unitIcon(unit) {
    if (unit.is_settler) return '🧑‍🌾';
    if (unit.is_scout) return '🔍';
    if (unit.is_siege_weapon) return '🎯';
    if (unit.is_cavalry) return '🐎';
    if (unit.defense_cavalry > unit.defense_infantry) return '🛡️';
    return '🚷';
}

function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
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

    const fetchCatalog = useCallback(async () => {
        try {
            const { data } = await api.get('combat/troop-types/');
            setCatalog(data);
        } catch (error) {
            console.error("خطا در دریافت فهرست نیروها", error);
        }
    }, []);

    const fetchQueue = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get('combat/barracks/queue/', { params: { village_id: activeVillageId } });
            setQueue(data);
        } catch (error) {
            console.error("خطا در دریافت صف آموزش", error);
        }
    }, [activeVillageId]);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchCatalog(), fetchQueue()]).finally(() => setLoading(false));
    }, [fetchCatalog, fetchQueue]);

    // به محض این‌که سرور از طریق وب‌سوکت خبر بده یک آموزش تمام شده، صف را
    // دوباره بخوان (قبلا اصلا وب‌سوکتی که واقعا وصل بشه وجود نداشت)
    useEffect(() => {
        if (lastMessage?.type === 'TROOP_TRAINING_COMPLETED') {
            fetchQueue();
        }
    }, [lastMessage, fetchQueue]);

    // شمارش معکوس محلی هر ثانیه برای آیتم‌های صف، بدون نیاز به پول کردن مداوم سرور
    useEffect(() => {
        const interval = setInterval(() => {
            setQueue((prev) =>
                prev
                    .map((item) => ({ ...item, remaining_seconds: Math.max(0, item.remaining_seconds - 1) }))
            );
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // پول کردن دوره‌ای صف هر ۲۰ ثانیه برای اطمینان از هماهنگی با سرور
    useEffect(() => {
        const interval = setInterval(fetchQueue, 20000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    const calculateMaxPossible = (costs) => {
        return Math.floor(Math.min(
            resources.wood / (costs.wood || 1),
            resources.clay / (costs.clay || 1),
            resources.iron / (costs.iron || 1),
            resources.crop / (costs.crop || 1)
        ));
    };

    const handleTrain = async (unit) => {
        const quantity = trainQty[unit.id] || 0;
        if (quantity <= 0) return;

        if (!activeVillageId) {
            alert("دهکده فعال هنوز مشخص نشده، لطفا لحظاتی صبر کنید و دوباره تلاش کنید.");
            return;
        }

        setSubmitting(unit.id);
        try {
            const response = await api.post('combat/barracks/train/', {
                village_id: activeVillageId,
                troop_type: unit.id,
                quantity,
            });
            alert(response.data.message);
            setTrainQty((prev) => ({ ...prev, [unit.id]: 0 }));
            fetchQueue();
        } catch (error) {
            alert("خطا: " + (error.response?.data?.error || "ارتباط با سرور برقرار نشد"));
        } finally {
            setSubmitting(null);
        }
    };

    if (loading) {
        return (
            <div className="w-full min-h-screen bg-stone-200 pt-28 flex items-center justify-center">
                <p className="font-bold text-gray-500">در حال بارگذاری پادگان...</p>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="bg-white p-6 rounded-lg shadow-xl border-t-4 border-amber-800 max-w-3xl w-full mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">⚔️ پادگان</h2>
                <p className="text-gray-500 mb-6 text-sm">
                    هر نیرویی که آموزش دهید بلافاصله وارد صف می‌شود و پس از اتمام زمان آموزش
                    به‌طور خودکار به نیروهای دهکده اضافه می‌شود.
                </p>

                <div className="space-y-6">
                    {catalog.map((unit) => {
                        const maxUnits = calculateMaxPossible(unit.costs);
                        const quantity = trainQty[unit.id] || 0;
                        const perUnitSeconds = unit.base_train_time;

                        return (
                            <div key={unit.id} className="border border-gray-300 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center bg-stone-50">
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-gray-800">
                                        {unitIcon(unit)} {unit.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        حمله: {unit.attack_power} | دفاع پیاده: {unit.defense_infantry} | دفاع سواره: {unit.defense_cavalry} | زمان هر واحد: {formatDuration(perUnitSeconds)}
                                    </p>
                                    <p className="text-[10px] text-purple-700 font-bold mt-1">
                                        🏗️ نیازمند: {unit.required_building}
                                    </p>
                                    <div className="flex gap-3 mt-3 text-xs font-bold text-gray-600">
                                        <span>🪵 {unit.costs.wood}</span>
                                        <span>🧱 {unit.costs.clay}</span>
                                        <span>⚒️ {unit.costs.iron}</span>
                                        <span>🌾 {unit.costs.crop}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto bg-white p-3 rounded shadow-sm border">
                                    <div className="flex flex-col items-center">
                                        <input
                                            type="number" min="0" max={maxUnits}
                                            value={quantity || ''}
                                            onChange={(e) => setTrainQty((prev) => ({ ...prev, [unit.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                                            className="w-20 p-2 border border-gray-400 rounded text-center font-bold outline-none focus:border-amber-600"
                                            placeholder="تعداد"
                                        />
                                        <button
                                            onClick={() => setTrainQty((prev) => ({ ...prev, [unit.id]: maxUnits }))}
                                            className="text-[10px] text-green-700 hover:underline mt-1 cursor-pointer font-bold"
                                        >
                                            (حداکثر: {maxUnits})
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleTrain(unit)}
                                        disabled={submitting === unit.id || quantity <= 0 || !activeVillageId}
                                        className="bg-amber-700 text-white px-4 py-2 rounded font-bold hover:bg-amber-800 transition disabled:bg-gray-400 whitespace-nowrap"
                                    >
                                        {submitting === unit.id ? "..." : "آموزش 🔨"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-xl border-t-4 border-blue-700 max-w-3xl w-full">
                <h2 className="text-xl font-bold text-gray-800 mb-4">⏳ صف آموزش فعلی</h2>
                {queue.length === 0 ? (
                    <p className="text-sm text-gray-500">در حال حاضر هیچ نیرویی در حال آموزش نیست.</p>
                ) : (
                    <div className="space-y-2">
                        {queue.map((item) => (
                            <div key={item.id} className="flex items-center justify-between border p-3 rounded bg-blue-50">
                                <span className="font-bold text-sm text-blue-900">{item.count}x {item.troop_name}</span>
                                <span className="font-mono font-bold text-blue-700" dir="ltr">
                                    {formatDuration(item.remaining_seconds)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}