import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import useGameStore from '../store/useGameStore';
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

const RESOURCE_LABELS = { wood: '🪵 چوب', clay: '🧱 خشت', iron: '⚒️ آهن', crop: '🌾 گندم' };

export default function Hero() {
    const { lastMessage } = useGameWebSocket();
    const villages = useGameStore((state) => state.villages);

    const [activeTab, setActiveTab] = useState('attributes'); // attributes | inventory | adventures
    const [hero, setHero] = useState(null);
    const [adventures, setAdventures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);

    const [revivalVillageId, setRevivalVillageId] = useState('');
    const [revivalCost, setRevivalCost] = useState(null);

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

    const fetchRevivalCost = useCallback(async () => {
        try {
            const { data } = await api.get('combat/hero/revive/');
            setRevivalCost(data.cost);
        } catch (error) {
            console.error('خطا در دریافت هزینه احیا', error);
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchHero(), fetchAdventures()]).finally(() => setLoading(false));
    }, [fetchHero, fetchAdventures]);

    useEffect(() => {
        if (hero && !hero.is_alive) fetchRevivalCost();
    }, [hero?.is_alive, fetchRevivalCost]);

    useEffect(() => {
        if (villages.length > 0 && !revivalVillageId) {
            const capital = villages.find((v) => v.is_capital) || villages[0];
            setRevivalVillageId(capital.id);
        }
    }, [villages, revivalVillageId]);

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

    // همگام‌سازی دوره‌ای هر ۲۰ ثانیه
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

    // ✅ تخصیص یک واحد امتیاز به یکی از خصیصه‌های قهرمان
    const handleAllocate = async (attribute) => {
        setBusy(attribute);
        try {
            await api.post('combat/hero/allocate-points/', { attribute, amount: 1 });
            fetchHero();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در تخصیص امتیاز');
        } finally {
            setBusy(null);
        }
    };

    const handleResourceTypeChange = async (resourceType) => {
        setBusy('resource_type');
        try {
            await api.post('combat/hero/settings/', { resource_production_type: resourceType });
            fetchHero();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در تغییر تنظیمات');
        } finally {
            setBusy(null);
        }
    };

    const handleToggleDefense = async () => {
        setBusy('defense_toggle');
        try {
            await api.post('combat/hero/settings/', { participates_in_defense: !hero.participates_in_defense });
            fetchHero();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در تغییر تنظیمات');
        } finally {
            setBusy(null);
        }
    };

    // ✅ احیای قهرمان مرده با پرداخت هزینه از یک دهکده‌ی انتخابی
    const handleRevive = async () => {
        if (!revivalVillageId) {
            alert('یک دهکده برای پرداخت هزینه‌ی احیا انتخاب کنید.');
            return;
        }
        setBusy('revive');
        try {
            const { data } = await api.post('combat/hero/revive/', { village_id: revivalVillageId });
            alert(data.message);
            fetchHero();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در احیای قهرمان');
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

    const ATTRIBUTES = [
        {
            key: 'fighting_strength',
            label: 'قدرت مبارزه',
            value: hero.fighting_strength_points,
            hint: 'مستقیماً به قدرت حمله و دفاع خود قهرمان اضافه می‌شود.',
        },
        {
            key: 'off_bonus',
            label: 'امتیاز تهاجمی',
            value: hero.off_bonus_points,
            hint: 'هر امتیاز ۰٫۵٪ به قدرت حمله‌ی کل ستون اعزامی همراه قهرمان اضافه می‌کند.',
        },
        {
            key: 'def_bonus',
            label: 'امتیاز دفاعی',
            value: hero.def_bonus_points,
            hint: 'هر امتیاز ۰٫۵٪ به قدرت دفاع دهکده‌ی خانگی قهرمان (وقتی حاضر باشد) اضافه می‌کند.',
        },
        {
            key: 'resource',
            label: 'امتیاز منابع',
            value: hero.resource_points,
            hint: 'هر امتیاز ۳ واحد در ساعت از منبع انتخاب‌شده در پایین تولید می‌کند.',
        },
    ];

    return (
        <div className="w-full min-h-screen bg-stone-200 pt-28 flex flex-col items-center pb-10">
            <ResourceBar />
            <Navbar />

            <div className="max-w-3xl w-full space-y-6">
                {/* کارت وضعیت قهرمان */}
                <div className="bg-gradient-to-b from-stone-800 to-stone-900 text-white p-6 rounded-lg shadow-2xl border-4 border-amber-900">
                    <div className="flex items-center gap-4 mb-4">
                        {/*
                          تصویر قهرمان.
                          مسیر پیشنهادی: public/assets/hero/hero_portrait.png
                          اگر بخواهید بر اساس نژاد/جنسیت فرق کند، می‌توانید از
                          public/assets/hero/{tribe}_{gender}.png استفاده کنید (مثلا roman_male.png)
                          و مسیر src را داینامیک بسازید.
                        */}
                        <img
                            src="/assets/hero/hero_portrait.png"
                            alt="قهرمان"
                            className="w-20 h-20 rounded-full border-4 border-amber-600 object-cover bg-stone-700 flex-shrink-0"
                            onError={(e) => {
                                e.target.style.visibility = 'hidden';
                            }}
                        />
                        <div>
                            <h1 className="text-2xl font-extrabold text-amber-500">🦸 قهرمان شما</h1>
                            <p className="text-xs text-gray-400 mt-1">سطح {hero.level} — سرعت حرکت پایه: ۷ خانه در ساعت</p>
                        </div>
                    </div>

                    {!hero.is_alive ? (
                        <div className="bg-red-900/60 border border-red-600 rounded p-4 text-center mb-4">
                            <p className="font-bold text-red-200 mb-3">⚰️ قهرمان شما از پای درآمده است.</p>
                            {revivalCost && (
                                <>
                                    <p className="text-xs text-red-100 mb-3">
                                        هزینه احیا: 🪵{revivalCost.wood} 🧱{revivalCost.clay} ⚒️{revivalCost.iron} 🌾{revivalCost.crop}
                                    </p>
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                        <select
                                            value={revivalVillageId}
                                            onChange={(e) => setRevivalVillageId(e.target.value)}
                                            className="text-black text-xs rounded p-2"
                                        >
                                            {villages.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                    {v.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={handleRevive}
                                            disabled={busy === 'revive'}
                                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded disabled:opacity-50"
                                        >
                                            {busy === 'revive' ? '...' : 'احیای قهرمان 🔮'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : hero.is_on_adventure ? (
                        <div className="bg-blue-900/40 border border-blue-500 rounded p-4 text-center mb-4">
                            <p className="font-bold text-blue-200">🗺️ قهرمان در حال ماجراجویی است...</p>
                            <p className="font-mono text-xl mt-1" dir="ltr">
                                {formatDuration(hero.adventure_remaining_seconds)}
                            </p>
                        </div>
                    ) : hero.is_away ? (
                        <div className="bg-purple-900/40 border border-purple-500 rounded p-4 text-center mb-4">
                            <p className="font-bold text-purple-200">
                                ⚔️ قهرمان در یک ماموریت نظامی به سر می‌برد و نمی‌تواند ماجراجویی برود یا در خانه دفاع کند.
                            </p>
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

                {/* تب‌ها: خصیصات / کوله‌پشتی / ماجراجویی‌ها */}
                <div className="bg-white rounded-lg shadow-md border border-gray-300 overflow-hidden">
                    <div className="flex border-b">
                        {[
                            { key: 'attributes', label: '📊 خصیصات' },
                            { key: 'inventory', label: '🎒 کوله‌پشتی' },
                            { key: 'adventures', label: '🗺️ ماجراجویی‌ها' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-3 text-sm font-bold transition ${activeTab === tab.key ? 'bg-amber-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {activeTab === 'attributes' && (
                            <div className="space-y-4">
                                <p className="text-sm font-bold text-gray-700">
                                    امتیاز قابل تخصیص:{' '}
                                    <span className="text-amber-700">{hero.available_attribute_points}</span> از{' '}
                                    {hero.total_attribute_points}
                                </p>

                                {ATTRIBUTES.map((attr) => (
                                    <div key={attr.key} className="flex items-center gap-3 border rounded p-3 bg-stone-50">
                                        <div className="flex-1">
                                            <p className="font-bold text-sm text-gray-800">
                                                {attr.label}: {attr.value}
                                            </p>
                                            <p className="text-[11px] text-gray-500">{attr.hint}</p>
                                        </div>
                                        <button
                                            onClick={() => handleAllocate(attr.key)}
                                            disabled={busy === attr.key || hero.available_attribute_points <= 0}
                                            className="w-9 h-9 rounded-full bg-green-700 text-white font-bold hover:bg-green-800 disabled:bg-gray-300 flex-shrink-0"
                                        >
                                            +
                                        </button>
                                    </div>
                                ))}

                                <div className="border-t pt-4">
                                    <p className="text-xs font-bold text-gray-600 mb-2">
                                        نوع منبعی که امتیاز «منابع» تولید می‌کند:
                                    </p>
                                    <div className="flex gap-3 flex-wrap">
                                        {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
                                            <label key={key} className="flex items-center gap-1 text-xs font-bold cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={hero.resource_production_type === key}
                                                    onChange={() => handleResourceTypeChange(key)}
                                                    disabled={busy === 'resource_type'}
                                                />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer border-t pt-4">
                                    <input
                                        type="checkbox"
                                        checked={hero.participates_in_defense}
                                        onChange={handleToggleDefense}
                                        disabled={busy === 'defense_toggle'}
                                    />
                                    قهرمان در دفاع از دهکده‌ی خانگی خود شرکت کند
                                </label>
                            </div>
                        )}

                        {activeTab === 'inventory' &&
                            (hero.inventory.length === 0 ? (
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
                            ))}

                        {activeTab === 'adventures' &&
                            (adventures.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                    در حال حاضر ماجراجویی‌ای در اطراف شما پیدا نشده؛ کمی بعد دوباره سر بزنید.
                                </p>
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
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}