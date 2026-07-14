import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import PageShell from '../components/PageShell';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { AlertModal } from '../components/Modal';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import { formatDuration } from '../utils/formatter';

const EQUIP_SLOTS = [
    { key: 'HELMET', label: 'کلاه‌خود' },
    { key: 'BODY', label: 'زره' },
    { key: 'SHIELD', label: 'سپر' },
    { key: 'LEFT_HAND', label: 'دست چپ' },
    { key: 'RIGHT_HAND', label: 'دست راست' },
    { key: 'SHOES', label: 'کفش' },
    { key: 'HORSE', label: 'اسب' },
];

const itemTypeIcon = (type) => ({
    HELMET: '⛑️', BODY: '🥋', SHIELD: '🛡️', LEFT_HAND: '⚔️',
    RIGHT_HAND: '🗡️', SHOES: '🥾', HORSE: '🐎',
}[type] || '🎒');

function itemBonusSummary(inv) {  // ✅ جدید
    const parts = [];
    if (inv.attack_bonus > 0) parts.push(`⚔️ حمله قهرمان +${inv.attack_bonus}`);
    if (inv.defense_bonus > 0) parts.push(`🛡️ دفاع قهرمان +${inv.defense_bonus}`);
    if (inv.speed_bonus > 0) parts.push(`⚡ سرعت +${inv.speed_bonus}`);
    if (inv.experience_bonus_percent > 0) parts.push(`✨ تجربه +${inv.experience_bonus_percent}٪`);
    if (inv.infantry_training_speed_percent > 0) parts.push(`🏃 سرعت آموزش پیاده +${inv.infantry_training_speed_percent}٪`);
    if (inv.cavalry_training_speed_percent > 0) parts.push(`🐎 سرعت آموزش سوار +${inv.cavalry_training_speed_percent}٪`);
    if (inv.infantry_attack_bonus_percent > 0) parts.push(`🗡️ حمله پیاده +${inv.infantry_attack_bonus_percent}٪`);
    if (inv.infantry_defense_bonus_percent > 0) parts.push(`🛡️ دفاع پیاده +${inv.infantry_defense_bonus_percent}٪`);
    if (inv.cavalry_attack_bonus_percent > 0) parts.push(`🗡️ حمله سوار +${inv.cavalry_attack_bonus_percent}٪`);
    if (inv.cavalry_defense_bonus_percent > 0) parts.push(`🛡️ دفاع سوار +${inv.cavalry_defense_bonus_percent}٪`);
    return parts;
}

const HAIR_COLORS = ['#3d2b1a', '#7a5230', '#c9a063', '#1a1a1a', '#a83232', '#e0e0e0'];
const difficultyStyle = (d) => ({
    EASY: 'border-brand-300 bg-brand-50 text-brand-800',
    NORMAL: 'border-gold-400 bg-gold-50 text-gold-700 bg-opacity-40',
    HARD: 'border-rose-300 bg-rose-50 text-rose-700',
}[d] || 'border-parchment-300 bg-parchment-50');
const RESOURCE_LABELS = { wood: '🪵 چوب', clay: '🧱 خشت', iron: '⚒️ آهن', crop: '🌾 گندم' };

function AppearanceTab({ hero, onSave }) {
    const [gender, setGender] = useState(hero.appearance?.gender || 'FEMALE');
    const [hairStyle, setHairStyle] = useState(hero.appearance?.hair_style || 1);
    const [hairColor, setHairColor] = useState(hero.appearance?.hair_color || HAIR_COLORS[0]);
    const [saving, setSaving] = useState(false);

    const [hairColorIndex, setHairColorIndex] = useState(hero.appearance?.hair_color || 1);

    const handleSave = async () => {
        setSaving(true);
        try { await onSave({ gender, hair_style: hairStyle, hair_color: hairColorIndex }); }
        finally { setSaving(false); }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <div className="flex gap-3 mb-4">
                    <button onClick={() => setGender('FEMALE')} className={`flex-1 p-2.5 rounded-xl border-2 font-bold transition ${gender === 'FEMALE' ? 'border-gold-500 bg-gold-50' : 'border-parchment-300'}`}>♀ زن</button>
                    <button onClick={() => setGender('MALE')} className={`flex-1 p-2.5 rounded-xl border-2 font-bold transition ${gender === 'MALE' ? 'border-gold-500 bg-gold-50' : 'border-parchment-300'}`}>♂ مرد</button>
                </div>

                <p className="field-label mb-2">مدل مو:</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button key={n} onClick={() => setHairStyle(n)}
                            className={`aspect-square rounded-xl border-2 overflow-hidden bg-white transition ${hairStyle === n ? 'border-gold-500' : 'border-parchment-300'}`}>
                            {/* عکس پیشنهادی: /assets/hero/hair_{gender}_{n}.png */}
                            <img src={`/assets/hero/hair_${gender.toLowerCase()}_${n}.png`} alt={`مدل ${n}`}
                                className="w-full h-full object-cover" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                        </button>
                    ))}
                </div>

                <p className="field-label mb-2">رنگ مو:</p>
                <div className="flex gap-2 mb-6 flex-wrap">
                    {HAIR_COLORS.map((c, idx) => (
                        <button key={c} onClick={() => setHairColorIndex(idx + 1)} style={{ backgroundColor: c }}
                            className={`w-8 h-8 rounded-full border-2 transition ${hairColorIndex === idx + 1 ? 'border-gold-600 ring-2 ring-gold-300' : 'border-parchment-300'}`} />
                    ))}
                </div>

                <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
                    {saving ? 'در حال ذخیره...' : '✅ ذخیره ظاهر'}
                </button>
            </div>

            <div className="flex items-center justify-center bg-parchment-100 rounded-xl border border-parchment-300 min-h-[280px]">
                {/* عکس پیشنهادی: /assets/hero/preview_{gender}_{hairStyle}.png */}
                <img src={`/assets/hero/preview_${gender.toLowerCase()}_${hairStyle}.png`} alt="پیش‌نمایش قهرمان"
                    className="max-h-80 object-contain" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
            </div>
        </div>
    );
}

function AuctionTab() {
    const [auctions, setAuctions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bidding, setBidding] = useState(null);
    const [bidAmounts, setBidAmounts] = useState({});
    const [alertMsg, setAlertMsg] = useState(null);

    const fetchAuctions = useCallback(async () => {
        try { const { data } = await api.get('combat/hero/auction/'); setAuctions(data); }
        catch { setAuctions([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAuctions(); }, [fetchAuctions]);
    useEffect(() => {
        const interval = setInterval(fetchAuctions, 15000);
        return () => clearInterval(interval);
    }, [fetchAuctions]);

    const handleBid = async (auctionId) => {
        const bidAmount = bidAmounts[auctionId];
        if (!bidAmount) return;
        setBidding(auctionId);
        try {
            const { data } = await api.post('combat/hero/auction/bid/', { auction_id: auctionId, bid_amount: bidAmount });
            setAlertMsg({ tone: 'success', text: data.message });
            fetchAuctions();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در ثبت پیشنهاد' });
        } finally { setBidding(null); }
    };

    if (loading) return <LoadingState label="در حال بارگذاری حراجی..." />;

    return (
        <>
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="حراجی" />
            {auctions.length === 0 ? (
                <EmptyState icon="🏺" title="در حال حاضر هیچ آیتمی در حراجی نیست." />
            ) : (
                <div className="space-y-2">
                    {auctions.map((a) => (
                        <div key={a.id} className="flex items-center justify-between border border-parchment-300 bg-parchment-50 rounded-xl p-3 gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-ink-800">{a.item_name}</p>
                                <p className="text-xs text-ink-500">
                                    بالاترین پیشنهاد: {a.current_bid} 💰 {a.current_bidder ? `(${a.current_bidder})` : ''}
                                </p>
                                <p className="text-[10px] text-ink-400 font-mono" dir="ltr">{formatDuration(a.remaining_seconds)}</p>
                            </div>
                            <input type="number" min={a.current_bid + 2} placeholder={`حداقل ${a.current_bid + 2}`}
                                value={bidAmounts[a.id] || ''}
                                onChange={(e) => setBidAmounts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                                className="field w-24 text-center text-xs" />
                            <button onClick={() => handleBid(a.id)} disabled={bidding === a.id} className="btn-gold text-xs">
                                {bidding === a.id ? '...' : 'پیشنهاد'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

const TABS = [
    { key: 'attributes', label: '📊 خصیصات' },
    { key: 'inventory', label: '🎒 کوله‌پشتی' },
    { key: 'appearance', label: '🎨 ظاهر' },
    { key: 'auction', label: '🏺 حراجی' },
    { key: 'adventures', label: '🗺️ ماجراجویی‌ها' },
];

export default function Hero() {
    const { lastMessage } = useGameWebSocket();
    const villages = useGameStore((state) => state.villages);

    const [activeTab, setActiveTab] = useState('attributes');
    const [hero, setHero] = useState(null);
    const [adventures, setAdventures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);
    const [alertMsg, setAlertMsg] = useState(null);

    const [revivalVillageId, setRevivalVillageId] = useState('');
    const [revivalCost, setRevivalCost] = useState(null);

    const fetchHero = useCallback(async () => {
        try { const { data } = await api.get('combat/hero/'); setHero(data); }
        catch (error) { console.error(error); }
    }, []);

    const fetchAdventures = useCallback(async () => {
        try { const { data } = await api.get('combat/hero/adventures/'); setAdventures(data); }
        catch (error) { console.error(error); }
    }, []);

    const fetchRevivalCost = useCallback(async () => {
        try { const { data } = await api.get('combat/hero/revive/'); setRevivalCost(data.cost); }
        catch (error) { console.error(error); }
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchHero(), fetchAdventures()]).finally(() => setLoading(false));
    }, [fetchHero, fetchAdventures]);

    useEffect(() => { if (hero && !hero.is_alive) fetchRevivalCost(); }, [hero?.is_alive, fetchRevivalCost]);

    useEffect(() => {
        if (villages.length > 0 && !revivalVillageId) {
            const capital = villages.find((v) => v.is_capital) || villages[0];
            setRevivalVillageId(capital.id);
        }
    }, [villages, revivalVillageId]);

    useEffect(() => {
        if (lastMessage?.type === 'ADVENTURE_RESULT') {
            setAlertMsg({ tone: 'info', text: lastMessage.data.message, title: 'نتیجه ماجراجویی' });
            fetchHero(); fetchAdventures();
        }
    }, [lastMessage, fetchHero, fetchAdventures]);

    useEffect(() => {
        if (!hero?.is_on_adventure) return;
        const interval = setInterval(() => {
            setHero((prev) => prev ? { ...prev, adventure_remaining_seconds: Math.max(0, prev.adventure_remaining_seconds - 1) } : prev);
        }, 1000);
        return () => clearInterval(interval);
    }, [hero?.is_on_adventure]);

    useEffect(() => {
        const interval = setInterval(() => { fetchHero(); fetchAdventures(); }, 20000);
        return () => clearInterval(interval);
    }, [fetchHero, fetchAdventures]);

    const handleEquip = async (inv) => {
        setBusy(inv.id);
        try { await api.post('combat/hero/equip/', { inventory_id: inv.id, equip: !inv.is_equipped }); fetchHero(); }
        catch (error) { setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در تجهیز آیتم' }); }
        finally { setBusy(null); }
    };

    const handleStartAdventure = async (adventureId) => {
        setBusy(adventureId);
        try {
            const { data } = await api.post('combat/hero/adventures/start/', { adventure_id: adventureId });
            setAlertMsg({ tone: 'success', text: data.message });
            fetchHero(); fetchAdventures();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در اعزام قهرمان' });
        } finally { setBusy(null); }
    };

    const handleAllocate = async (attribute) => {
        setBusy(attribute);
        try { await api.post('combat/hero/allocate-points/', { attribute, amount: 1 }); fetchHero(); }
        catch (error) { setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در تخصیص امتیاز' }); }
        finally { setBusy(null); }
    };

    const handleSaveAppearance = async (payload) => {
        try {
            const { data } = await api.post('combat/hero/appearance/', payload);
            setAlertMsg({ tone: 'success', text: data.message || 'ظاهر قهرمان بروزرسانی شد.' });
            fetchHero();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'این قابلیت هنوز در سرور فعال نشده است.' });
        }
    };

    const handleResourceTypeChange = async (resourceType) => {
        setBusy('resource_type');
        try { await api.post('combat/hero/settings/', { resource_production_type: resourceType }); fetchHero(); }
        catch (error) { setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در تغییر تنظیمات' }); }
        finally { setBusy(null); }
    };

    const handleToggleDefense = async () => {
        setBusy('defense_toggle');
        try { await api.post('combat/hero/settings/', { participates_in_defense: !hero.participates_in_defense }); fetchHero(); }
        catch (error) { setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در تغییر تنظیمات' }); }
        finally { setBusy(null); }
    };

    const handleRevive = async () => {
        if (!revivalVillageId) { setAlertMsg({ tone: 'error', text: 'یک دهکده برای پرداخت هزینه‌ی احیا انتخاب کنید.' }); return; }
        setBusy('revive');
        try {
            const { data } = await api.post('combat/hero/revive/', { village_id: revivalVillageId });
            setAlertMsg({ tone: 'success', text: data.message });
            fetchHero();
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در احیای قهرمان' });
        } finally { setBusy(null); }
    };

    if (loading || !hero) return <PageShell><LoadingState label="در حال احضار قهرمان..." /></PageShell>;

    const xpProgress = Math.min(100, hero.experience % 100);
    const ATTRIBUTES = [
        { key: 'fighting_strength', label: 'قدرت مبارزه', value: hero.fighting_strength_points, hint: 'مستقیماً به قدرت حمله و دفاع خود قهرمان اضافه می‌شود.' },
        { key: 'off_bonus', label: 'امتیاز تهاجمی', value: hero.off_bonus_points, hint: 'هر امتیاز ۰٫۵٪ به قدرت حمله‌ی کل ستون اعزامی همراه قهرمان اضافه می‌کند.' },
        { key: 'def_bonus', label: 'امتیاز دفاعی', value: hero.def_bonus_points, hint: 'هر امتیاز ۰٫۵٪ به قدرت دفاع دهکده‌ی خانگی قهرمان اضافه می‌کند.' },
        { key: 'resource', label: 'امتیاز منابع', value: hero.resource_points, hint: 'هر امتیاز ۳ واحد در ساعت از منبع انتخاب‌شده تولید می‌کند.' },
    ];

    return (
        <PageShell maxWidth="max-w-4xl">
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title={alertMsg?.title || 'قهرمان'} />

            <div className="rounded-2xl overflow-hidden shadow-card border border-ink-700">
                <div className="bg-gradient-to-b from-ink-800 to-ink-900 p-6 text-parchment-100">
                    <div className="flex items-center gap-4 mb-4">
                        {/* عکس پیشنهادی: /assets/hero/hero_portrait.png */}
                        <img src="/assets/hero/hero_portrait.png" alt="قهرمان"
                            className="w-20 h-20 rounded-full border-4 border-gold-500 object-cover bg-ink-700 flex-shrink-0"
                            onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                        <div>
                            <h1 className="text-2xl font-extrabold text-gold-400">🦸 قهرمان شما</h1>
                            <p className="text-xs text-parchment-400 mt-1">سطح {hero.level}</p>
                        </div>
                    </div>

                    {!hero.is_alive ? (
                        <div className="bg-rose-950/60 border border-rose-700 rounded-xl p-4 text-center mb-4">
                            <p className="font-bold text-rose-200 mb-3">⚰️ قهرمان شما از پای درآمده است.</p>
                            {revivalCost && (
                                <>
                                    <p className="text-xs text-rose-100 mb-3">
                                        هزینه احیا: 🪵{revivalCost.wood} 🧱{revivalCost.clay} ⚒️{revivalCost.iron} 🌾{revivalCost.crop}
                                    </p>
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                        <select value={revivalVillageId} onChange={(e) => setRevivalVillageId(e.target.value)}
                                            className="text-ink-800 text-xs rounded-lg p-2 border-0">
                                            {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>
                                        <button onClick={handleRevive} disabled={busy === 'revive'} className="btn-gold text-xs">
                                            {busy === 'revive' ? '...' : 'احیای قهرمان 🔮'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : hero.is_on_adventure ? (
                        <div className="bg-blue-950/50 border border-blue-600 rounded-xl p-4 text-center mb-4">
                            <p className="font-bold text-blue-200">🗺️ قهرمان در حال ماجراجویی است...</p>
                            <p className="font-mono text-xl mt-1 text-gold-300" dir="ltr">{formatDuration(hero.adventure_remaining_seconds)}</p>
                        </div>
                    ) : hero.is_away ? (
                        <div className="bg-purple-950/50 border border-purple-600 rounded-xl p-4 text-center mb-4">
                            <p className="font-bold text-purple-200">⚔️ قهرمان در یک ماموریت نظامی است و نمی‌تواند ماجراجویی برود یا در خانه دفاع کند.</p>
                        </div>
                    ) : null}

                    <div className="flex items-center justify-between mb-2 text-sm font-bold">
                        <span>سطح {hero.level}</span><span>{hero.experience} XP</span>
                    </div>
                    <div className="progress-track !bg-white/10 mb-4">
                        <div className="h-full bg-gradient-to-l from-gold-400 to-gold-600 rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
                    </div>

                    <div className="flex items-center justify-between mb-2 text-sm font-bold">
                        <span>❤️ سلامتی</span><span>{hero.health}%</span>
                    </div>
                    <div className="progress-track !bg-white/10">
                        <div className={`h-full rounded-full transition-all ${hero.health > 50 ? 'bg-brand-400' : hero.health > 20 ? 'bg-gold-400' : 'bg-rose-500'}`} style={{ width: `${hero.health}%` }} />
                    </div>
                </div>
            </div>

            <div className="panel overflow-hidden">
                <div className="flex overflow-x-auto border-b border-parchment-300">
                    {TABS.map((tab) => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 min-w-[110px] py-3 text-sm font-bold transition whitespace-nowrap ${activeTab === tab.key ? 'bg-gold-500 text-ink-900' : 'bg-parchment-100 text-ink-600 hover:bg-parchment-200'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="panel-body">
                    {activeTab === 'attributes' && (
                        <div className="space-y-3">
                            <p className="text-sm font-bold text-ink-700">
                                امتیاز قابل تخصیص: <span className="text-gold-600">{hero.available_attribute_points}</span> از {hero.total_attribute_points}
                            </p>
                            {ATTRIBUTES.map((attr) => (
                                <div key={attr.key} className="flex items-center gap-3 border border-parchment-300 rounded-xl p-3 bg-parchment-50">
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-ink-800">{attr.label}: {attr.value}</p>
                                        <p className="text-[11px] text-ink-500">{attr.hint}</p>
                                    </div>
                                    <button onClick={() => handleAllocate(attr.key)} disabled={busy === attr.key || hero.available_attribute_points <= 0}
                                        className="w-9 h-9 rounded-full bg-gradient-to-b from-brand-500 to-brand-700 text-white font-bold hover:from-brand-400 disabled:opacity-30 flex-shrink-0 transition">+</button>
                                </div>
                            ))}

                            <div className="border-t border-parchment-300 pt-4">
                                <p className="field-label mb-2">نوع منبعی که امتیاز «منابع» تولید می‌کند:</p>
                                <div className="flex gap-3 flex-wrap">
                                    {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
                                        <label key={key} className="flex items-center gap-1.5 text-xs font-bold cursor-pointer bg-white border border-parchment-300 rounded-full px-3 py-1.5">
                                            <input type="radio" checked={hero.resource_production_type === key} onChange={() => handleResourceTypeChange(key)} disabled={busy === 'resource_type'} />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer border-t border-parchment-300 pt-4">
                                <input type="checkbox" checked={hero.participates_in_defense} onChange={handleToggleDefense} disabled={busy === 'defense_toggle'} />
                                قهرمان در دفاع از دهکده‌ی خانگی خود شرکت کند
                            </label>
                        </div>
                    )}

                    {activeTab === 'inventory' && (
                        <div>
                            <p className="field-label mb-2">تجهیزات فعلی:</p>
                            <div className="grid grid-cols-4 gap-3 mb-6">
                            {EQUIP_SLOTS.map((slot) => {
                                const equipped = hero.inventory.find((inv) => inv.item_type === slot.key && inv.is_equipped);
                                return (
                                    <div
                                        key={slot.key}
                                        className={`equip-slot ${equipped ? 'filled' : ''}`}
                                        title={equipped ? `${equipped.name} — ${itemBonusSummary(equipped).join(' · ')}` : slot.label}  // ✅ جدید
                                        onClick={() => equipped && handleEquip(equipped)}
                                    >
                                        {equipped ? <span className="text-3xl">{itemTypeIcon(equipped.item_type)}</span> : <span className="text-[10px] text-ink-400 text-center px-1">{slot.label}</span>}
                                    </div>
                                );
                            })}
                        </div>
                            <p className="field-label mb-2">کوله‌پشتی:</p>
                            {hero.inventory.filter((inv) => !inv.is_equipped).length === 0 ? (
                                <EmptyState icon="🎒" title="آیتم درون کوله‌پشتی نیست." />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {hero.inventory.filter((inv) => !inv.is_equipped).map((inv) => (
                                        <div key={inv.id} className="flex items-center justify-between border border-parchment-300 p-3 rounded-xl bg-parchment-50">
                                            <div key={inv.id} className="flex items-center justify-between border border-parchment-300 p-3 rounded-xl bg-parchment-50">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{itemTypeIcon(inv.item_type)}</span>
                                                    <div>
                                                        <p className="font-bold text-sm text-ink-800">{inv.name}</p>
                                                        <p className="text-xs text-ink-500">{itemBonusSummary(inv).join(' · ')}</p>  {/* ✅ به‌روزشده */}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleEquip(inv)} disabled={busy === inv.id} className="btn-gold text-xs">پوشیدن</button>
                                            </div>
                                            <button onClick={() => handleEquip(inv)} disabled={busy === inv.id} className="btn-gold text-xs">پوشیدن</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'adventures' && (
                        adventures.length === 0 ? (
                            <EmptyState icon="🗺️" title="در حال حاضر ماجراجویی‌ای پیدا نشده" description="کمی بعد دوباره سر بزنید." />
                        ) : (
                            <div className="space-y-2">
                                {adventures.map((adv) => (
                                    <div key={adv.id} className={`flex items-center justify-between border-2 rounded-xl p-3 ${difficultyStyle(adv.difficulty)}`}>
                                        <p className="font-bold text-sm">{adv.difficulty_display} — ({adv.x_coord}|{adv.y_coord})</p>
                                        <button onClick={() => handleStartAdventure(adv.id)}
                                            disabled={busy === adv.id || hero.is_on_adventure || !hero.is_alive || hero.health < 20}
                                            className="btn-primary text-xs">اعزام قهرمان ⚔️</button>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {activeTab === 'appearance' && <AppearanceTab hero={hero} onSave={handleSaveAppearance} />}
                    {activeTab === 'auction' && <AuctionTab />}
                </div>
            </div>
        </PageShell>
    );
}