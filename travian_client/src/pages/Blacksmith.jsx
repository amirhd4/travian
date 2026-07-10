import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import WoodSign from '../components/WoodSign';
import useGameStore from '../store/useGameStore';

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

    useEffect(() => {
        setLoading(true);
        fetchData();
    }, [fetchData]);

    // شمارش معکوس محلی هر ثانیه برای آیتم‌های در حال ارتقا
    useEffect(() => {
        const interval = setInterval(() => {
            setData((prev) => ({
                ...prev,
                troops: prev.troops.map((t) => {
                    if (!t.is_upgrading || !t.upgrade_ends_at) return t;
                    const remaining = Math.max(
                        0,
                        Math.round((new Date(t.upgrade_ends_at).getTime() - Date.now()) / 1000)
                    );
                    return { ...t, _remaining: remaining };
                }),
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // همگام‌سازی دوره‌ای هر ۲۰ ثانیه با سرور
    useEffect(() => {
        const interval = setInterval(fetchData, 20000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleUpgrade = async (troopTypeId) => {
        setSubmitting(troopTypeId);
        try {
            const response = await api.post('combat/blacksmith/', {
                village_id: activeVillageId,
                troop_type_id: troopTypeId,
            });
            alert(response.data.message);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در شروع ارتقا');
        } finally {
            setSubmitting(null);
        }
    };

    if (loading) {
        return (
            <div className="w-full min-h-screen bg-stone-200 pt-28 flex items-center justify-center">
                <p className="font-bold text-gray-500">در حال بارگذاری آهنگری...</p>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="max-w-3xl w-full">
                <WoodSign title="🔨 آهنگری">
                    {!data.has_blacksmith ? (
                        <p className="text-center text-sm font-bold text-red-700 py-6">
                            {errorMsg || 'ابتدا باید ساختمان آهنگری را در این دهکده بسازید.'}
                        </p>
                    ) : (
                        <>
                            <p className="text-center text-xs text-wood-dark mb-4 leading-relaxed">
                                سطح آهنگری این دهکده: <span className="font-bold">{data.blacksmith_level}</span>
                                <br />
                                هر لول ارتقای یک نوع نیرو، قدرت حمله و دفاع همان نیرو را — وقتی از این دهکده اعزام
                                شود یا در آن مستقر باشد — به میزان ۲٪ افزایش می‌دهد (حداکثر ۲۰ لول).
                            </p>

                            <div className="space-y-3">
                                {data.troops.map((t) => {
                                    const remaining =
                                        t._remaining ??
                                        Math.max(0, Math.round((new Date(t.upgrade_ends_at).getTime() - Date.now()) / 1000));
                                    const isMax = t.level >= t.max_level;

                                    return (
                                        <div
                                            key={t.troop_type_id}
                                            className="flex items-center gap-4 bg-white/70 border border-wood-light rounded-lg p-3"
                                        >
                                            {/*
                                              آیکون نیرو.
                                              مسیر پیشنهادی برای عکس‌ها: public/assets/troops/unit_{troop_type_id}.png
                                              (مثلا public/assets/troops/unit_1.png برای اولین نیروی رومی)
                                              اگر عکس موجود نباشد، جای آن خالی نمایش داده می‌شود و کل کارت به هم نمی‌ریزد.
                                            */}
                                            <img
                                                src={`/assets/troops/unit_${t.troop_type_id}.png`}
                                                alt={t.name}
                                                className="w-14 h-14 object-contain bg-stone-100 rounded border border-wood-light flex-shrink-0"
                                                onError={(e) => {
                                                    e.target.style.visibility = 'hidden';
                                                }}
                                            />

                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-wood-dark">{t.name}</p>
                                                <p className="text-xs text-gray-500">
                                                    سطح فعلی: {t.level} از {t.max_level}
                                                </p>
                                                {!isMax && t.next_level_cost && (
                                                    <p className="text-[10px] text-gray-600 mt-1 flex gap-3 flex-wrap">
                                                        <span>🪵 {t.next_level_cost.wood}</span>
                                                        <span>🧱 {t.next_level_cost.clay}</span>
                                                        <span>⚒️ {t.next_level_cost.iron}</span>
                                                        <span>🌾 {t.next_level_cost.crop}</span>
                                                    </p>
                                                )}
                                            </div>

                                            <div className="text-center min-w-[140px] flex-shrink-0">
                                                {isMax ? (
                                                    <span className="text-xs font-bold text-green-700">🏆 حداکثر لول</span>
                                                ) : t.is_upgrading ? (
                                                    <span className="font-mono font-bold text-blue-700 text-sm" dir="ltr">
                                                        {formatDuration(remaining)}
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleUpgrade(t.troop_type_id)}
                                                        disabled={submitting === t.troop_type_id}
                                                        className="btn-travian-green text-xs px-4 py-1.5 disabled:opacity-50"
                                                    >
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
            </div>
        </div>
    );
}