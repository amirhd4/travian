import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

function formatDuration(totalSeconds) {
    if (totalSeconds <= 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

const itemTypeIcon = (type) => ({ HELMET: '⛑️', WEAPON: '⚔️', HORSE: '🐎' }[type] || '🎒');
const difficultyColor = (d) => ({
    EASY: 'border-green-400 bg-green-50 text-green-800',
    NORMAL: 'border-amber-400 bg-amber-50 text-amber-800',
    HARD: 'border-red-400 bg-red-50 text-red-800',
}[d] || 'border-gray-300 bg-gray-50');

export default function Hero() {
    const { lastMessage } = useGameWebSocket();
    const [hero, setHero] = useState(null);
    const [adventures, setAdventures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);

    const fetchHero = useCallback(async () => {
        try {
            const { data } = await api.get('combat/hero/');
            setHero(data);
        } catch (error) {
            console.error('خطا در دریافت اطلاعات قهرمان', error);
        }
    }, []);

    const fetchAdventures = useCallback(async () => {
        try {
            const { data } = await api.get('combat/hero/adventures/');
            setAdventures(data);
        } catch (error) {
            console.error('خطا در دریافت ماجراجویی‌ها', error);
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchHero(), fetchAdventures()]).finally(() => setLoading(false));
    }, [fetchHero, fetchAdventures]);

    // با اتمام یک ماجراجویی (پیام وب‌سوکت)، اطلاعات قهرمان و لیست ماجراجویی‌ها را دوباره بخوان
    useEffect(() => {
        if (lastMessage?.type === 'ADVENTURE_RESULT') {
            alert(lastMessage.data.message);
            fetchHero();
            fetchAdventures();
        }
    }, [lastMessage, fetchHero, fetchAdventures]);

    // شمارش معکوس محلی برای زمان بازگشت از ماجراجویی
    useEffect(() => {
        if (!hero?.is_on_adventure) return;
        const interval = setInterval(() => {
            setHero((prev) =>
                prev ? { ...prev, adventure_remaining_seconds: Math.max(0, prev.adventure_remaining_seconds - 1) } : prev
            );
        }, 1000);
        return () => clearInterval(interval);
    }, [hero?.is_on_adventure]);

    // همگام‌سازی دوره‌ای هر ۲۰ ثانیه (برای بازیابی سلامتی و ماجراجویی‌های جدید)
    useEffect(() => {
        const interval = setInterval(() => {
            fetchHero();
            fetchAdventures();
        }, 20000);
        return () => clearInterval(interval);
    }, [fetchHero, fetchAdventures]);

    const handleEquip = async (inv) => {
        setBusy(inv.id);
        try {
            await api.post('combat/hero/equip/', { inventory_id: inv.id, equip: !inv.is_equipped });
            fetchHero();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در تجهیز آیتم');
        } finally {
            setBusy(null);
        }
    };

    const handleStartAdventure = async (adventureId) => {
        setBusy(adventureId);
        try {
            const { data } = await api.post('combat/hero/adventures/start/', { adventure_id: adventureId });
            alert(data.message);
            fetchHero();
            fetchAdventures();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در اعزام قهرمان');
        } finally {
            setBusy(null);
        }
    };

    if (loading || !hero) {
        return (
            <div className="w-full min-h-screen bg-stone-200 pt-28 flex items-center justify-center">
                <p className="font-bold text-gray-500">در حال احضار قهرمان...</p>
            </div>
        );
    }

    const xpProgress = Math.min(100, hero.experience % 100);

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="max-w-3xl w-full space-y-6">
                {/* کارت وضعیت قهرمان */}
                <div className="bg-gradient-to-b from-stone-800 to-stone-900 text-white p-6 rounded-lg shadow-2xl border-4 border-amber-900">
                    <h1 className="text-2xl font-extrabold text-amber-500 mb-4">🦸 قهرمان شما</h1>

                    {!hero.is_alive ? (
                        <div className="bg-red-900/60 border border-red-600 rounded p-4 text-center mb-4">
                            <p className="font-bold text-red-200">⚰️ قهرمان شما از پای درآمده است و در حال استراحت است.</p>
                        </div>
                    ) : hero.is_on_adventure ? (
                        <div className="bg-blue-900/40 border border-blue-500 rounded p-4 text-center mb-4">
                            <p className="font-bold text-blue-200">🗺️ قهرمان در حال ماجراجویی است...</p>
                            <p className="font-mono text-xl mt-1" dir="ltr">{formatDuration(hero.adventure_remaining_seconds)}</p>
                        </div>
                    ) : null}

                    <div className="flex items-center justify-between mb-2 text-sm font-bold">
                        <span>سطح {hero.level}</span>
                        <span>{hero.experience} XP</span>
                    </div>
                    <div className="w-full bg-stone-700 rounded-full h-3 mb-4 overflow-hidden">
                        <div className="bg-amber-500 h-3 transition-all" style={{ width: `${xpProgress}%` }} />
                    </div>

                    <div className="flex items-center justify-between mb-2 text-sm font-bold">
                        <span>❤️ سلامتی</span>
                        <span>{hero.health}%</span>
                    </div>
                    <div className="w-full bg-stone-700 rounded-full h-3 overflow-hidden">
                        <div
                            className={`h-3 transition-all ${hero.health > 50 ? 'bg-green-500' : hero.health > 20 ? 'bg-yellow-500' : 'bg-red-600'}`}
                            style={{ width: `${hero.health}%` }}
                        />
                    </div>
                </div>

                {/* کوله‌پشتی قهرمان */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-300">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">🎒 کوله‌پشتی</h2>
                    {hero.inventory.length === 0 ? (
                        <p className="text-sm text-gray-500">هیچ آیتمی در کوله‌پشتی قهرمان نیست.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {hero.inventory.map((inv) => (
                                <div
                                    key={inv.id}
                                    className={`flex items-center justify-between border p-3 rounded ${
                                        inv.is_equipped ? 'bg-amber-50 border-amber-400' : 'bg-stone-50 border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{itemTypeIcon(inv.item_type)}</span>
                                        <div>
                                            <p className="font-bold text-sm">{inv.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {inv.attack_bonus > 0 && `⚔️ +${inv.attack_bonus} `}
                                                {inv.speed_bonus > 0 && `⚡ +${inv.speed_bonus}`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleEquip(inv)}
                                        disabled={busy === inv.id}
                                        className={`text-xs font-bold px-3 py-1.5 rounded transition ${
                                            inv.is_equipped
                                                ? 'bg-gray-500 text-white hover:bg-gray-600'
                                                : 'bg-amber-600 text-white hover:bg-amber-700'
                                        }`}
                                    >
                                        {inv.is_equipped ? 'درآوردن' : 'پوشیدن'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ماجراجویی‌های موجود */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-300">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">🗺️ ماجراجویی‌های موجود</h2>
                    {adventures.length === 0 ? (
                        <p className="text-sm text-gray-500">در حال حاضر ماجراجویی‌ای در اطراف شما پیدا نشده؛ کمی بعد دوباره سر بزنید.</p>
                    ) : (
                        <div className="space-y-2">
                            {adventures.map((adv) => (
                                <div
                                    key={adv.id}
                                    className={`flex items-center justify-between border p-3 rounded ${difficultyColor(adv.difficulty)}`}
                                >
                                    <p className="font-bold text-sm">
                                        {adv.difficulty_display} — مختصات ({adv.x_coord}|{adv.y_coord})
                                    </p>
                                    <button
                                        onClick={() => handleStartAdventure(adv.id)}
                                        disabled={busy === adv.id || hero.is_on_adventure || !hero.is_alive || hero.health < 20}
                                        className="text-xs font-bold px-4 py-2 rounded bg-stone-800 text-white hover:bg-stone-900 disabled:bg-gray-400 transition"
                                    >
                                        اعزام قهرمان ⚔️
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}