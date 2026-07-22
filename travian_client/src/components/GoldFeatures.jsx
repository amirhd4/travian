import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import WoodSign from './WoodSign';
import { AlertModal } from './Modal';
import useGameStore from '../store/useGameStore';

const RESOURCE_BONUS_TYPES = [
    { value: 'all', label: 'همه منابع', image: '/assets/ui/res-5.gif' },
    { value: 'wood', label: 'چوب', image: '/assets/ui/res-1.gif' },
    { value: 'clay', label: 'خشت', image: '/assets/ui/res-2.gif' },
    { value: 'iron', label: 'آهن', image: '/assets/ui/res-3.gif' },
    { value: 'crop', label: 'گندم', image: '/assets/ui/res-4.gif' },
];

const PACKAGES = [1, 10, 50, 100, 500, 1000];
const BUNDLE_PACKAGES = [100, 500, 1000, 5000, 10000];

function fmt(n) { return n.toLocaleString('fa-IR'); }

function TroopCard({ item, qty, pkg, onStep, onSetQty, onSetPkg, onBuy, busy, currency, villageId }) {
    const price = currency === 'gold' ? item.gold_price : item.silver_price;
    const unit = currency === 'gold' ? '💰' : '🪙';
    const totalCost = price * qty;
    const key = `troop-${item.id}`;
    const labels = [];
    if (item.is_cavalry) labels.push('سواره');
    if (item.is_siege_weapon) labels.push('محاصره');
    if (item.is_ram) labels.push('قورچی');
    if (item.is_catapult) labels.push('منجنیق');

    return (
        <div className="bg-white border border-parchment-200 rounded-lg overflow-hidden">
            <div className="bg-parchment-100 px-3 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink-800">{item.name}</span>
                    {labels.length > 0 && labels.map((l) => (
                        <span key={l} className="text-[9px] px-1.5 py-0.5 rounded bg-parchment-300 text-ink-600 font-bold">{l}</span>
                    ))}
                </div>
                <span className="text-[11px] font-bold text-gold-600">{item.gold_price} 💰 / {item.silver_price} 🪙</span>
            </div>
            <div className="px-3 py-2">
                {/* Stats row */}
                <div className="grid grid-cols-4 gap-1 text-center mb-2">
                    <div className="bg-red-50 rounded py-1"><div className="text-[9px] text-ink-400">حمله</div><div className="text-[11px] font-bold text-red-600">{fmt(item.attack_power)}</div></div>
                    <div className="bg-blue-50 rounded py-1"><div className="text-[9px] text-ink-400">دفاع پیاده</div><div className="text-[11px] font-bold text-blue-600">{fmt(item.defense_infantry)}</div></div>
                    <div className="bg-purple-50 rounded py-1"><div className="text-[9px] text-ink-400">دفاع سواره</div><div className="text-[11px] font-bold text-purple-600">{fmt(item.defense_cavalry)}</div></div>
                    <div className="bg-green-50 rounded py-1"><div className="text-[9px] text-ink-400">سرعت</div><div className="text-[11px] font-bold text-green-600">{fmt(item.speed)}</div></div>
                </div>
                {/* Resource costs */}
                <div className="flex items-center gap-2 text-[10px] text-ink-500 mb-2">
                    <span className="flex items-center gap-0.5"><img src="/assets/ui/res-1.gif" className="w-3 h-3" alt="" />{fmt(item.wood_cost)}</span>
                    <span className="flex items-center gap-0.5"><img src="/assets/ui/res-2.gif" className="w-3 h-3" alt="" />{fmt(item.clay_cost)}</span>
                    <span className="flex items-center gap-0.5"><img src="/assets/ui/res-3.gif" className="w-3 h-3" alt="" />{fmt(item.iron_cost)}</span>
                    <span className="flex items-center gap-0.5"><img src="/assets/ui/res-4.gif" className="w-3 h-3" alt="" />{fmt(item.crop_cost)}</span>
                    <span className="text-ink-400 mr-1">|</span>
                    <span>حمل: {fmt(item.carry_capacity)}</span>
                    <span>مصرف: {fmt(item.crop_upkeep)}/ساعت</span>
                </div>
                {/* Quantity controls */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <button onClick={() => onStep(key, -pkg)} className="w-7 h-7 rounded bg-parchment-200 hover:bg-parchment-300 text-sm font-bold flex items-center justify-center transition-colors">−</button>
                        <input type="number" min="0" value={qty || ''} onChange={(e) => onSetQty(key, Math.max(0, parseInt(e.target.value, 10) || 0))} className="field w-16 text-center text-xs" />
                        <button onClick={() => onStep(key, pkg)} className="w-7 h-7 rounded bg-parchment-200 hover:bg-parchment-300 text-sm font-bold flex items-center justify-center transition-colors">+</button>
                    </div>
                    <div className="flex items-center gap-1">
                        {PACKAGES.map((p) => (
                            <button key={p} onClick={() => onSetPkg(key, p)} className={`text-[10px] px-1.5 py-0.5 rounded border font-bold transition-colors ${pkg === p ? 'bg-gold-500 text-white border-gold-600' : 'bg-white text-ink-600 border-parchment-300 hover:border-gold-400'}`}>
                                {p >= 1000 ? `${p / 1000}K` : p}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Total + buy */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-parchment-100">
                    <div className="text-[11px]">
                        {qty > 0 ? (
                            <span><b className="text-ink-700">{fmt(qty)}</b> عدد — <b className="text-gold-600">{fmt(totalCost)} {unit}</b></span>
                        ) : (
                            <span className="text-ink-400">تعداد را وارد کنید</span>
                        )}
                    </div>
                    <button onClick={() => onBuy(item)} disabled={busy === `troopshop-${key}` || !villageId || qty <= 0} className="btn-gold text-xs !px-4 !py-1.5">
                        {busy === `troopshop-${key}` ? '...' : 'خرید'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function AnimalCard({ item, qty, pkg, onStep, onSetQty, onSetPkg, onBuy, busy, currency, villageId }) {
    const price = currency === 'gold' ? item.gold_price : item.silver_price;
    const unit = currency === 'gold' ? '💰' : '🪙';
    const totalCost = price * qty;
    const key = `animal-${item.id}`;

    return (
        <div className="bg-white border border-parchment-200 rounded-lg overflow-hidden">
            <div className="bg-amber-50 px-3 py-1.5 flex items-center justify-between">
                <span className="text-xs font-bold text-ink-800">🐾 {item.name}</span>
                <span className="text-[11px] font-bold text-gold-600">{item.gold_price} 💰 / {item.silver_price} 🪙</span>
            </div>
            <div className="px-3 py-2">
                <div className="grid grid-cols-2 gap-1 text-center mb-2">
                    <div className="bg-blue-50 rounded py-1"><div className="text-[9px] text-ink-400">دفاع پیاده</div><div className="text-[11px] font-bold text-blue-600">{fmt(item.defense_infantry)}</div></div>
                    <div className="bg-purple-50 rounded py-1"><div className="text-[9px] text-ink-400">دفاع سواره</div><div className="text-[11px] font-bold text-purple-600">{fmt(item.defense_cavalry)}</div></div>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <button onClick={() => onStep(key, -pkg)} className="w-7 h-7 rounded bg-parchment-200 hover:bg-parchment-300 text-sm font-bold flex items-center justify-center">−</button>
                        <input type="number" min="0" value={qty || ''} onChange={(e) => onSetQty(key, Math.max(0, parseInt(e.target.value, 10) || 0))} className="field w-16 text-center text-xs" />
                        <button onClick={() => onStep(key, pkg)} className="w-7 h-7 rounded bg-parchment-200 hover:bg-parchment-300 text-sm font-bold flex items-center justify-center">+</button>
                    </div>
                    <div className="flex items-center gap-1">
                        {PACKAGES.map((p) => (
                            <button key={p} onClick={() => onSetPkg(key, p)} className={`text-[10px] px-1.5 py-0.5 rounded border font-bold transition-colors ${pkg === p ? 'bg-gold-500 text-white border-gold-600' : 'bg-white text-ink-600 border-parchment-300 hover:border-gold-400'}`}>
                                {p >= 1000 ? `${p / 1000}K` : p}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-parchment-100">
                    <div className="text-[11px]">
                        {qty > 0 ? (
                            <span><b className="text-ink-700">{fmt(qty)}</b> عدد — <b className="text-gold-600">{fmt(totalCost)} {unit}</b></span>
                        ) : (
                            <span className="text-ink-400">تعداد را وارد کنید</span>
                        )}
                    </div>
                    <button onClick={() => onBuy(item)} disabled={busy === `troopshop-${key}` || !villageId || qty <= 0} className="btn-gold text-xs !px-4 !py-1.5">
                        {busy === `troopshop-${key}` ? '...' : 'خرید'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function GoldFeatures() {
    const setUser = useGameStore((state) => state.setUser);
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const villages = useGameStore((state) => state.villages);
    const activeVillage = villages.find((v) => v.id === activeVillageId);

    const [alertMsg, setAlertMsg] = useState(null);
    const [busy, setBusy] = useState(null);

    const [goldClubStatus, setGoldClubStatus] = useState(null);
    const [silverStatus, setSilverStatus] = useState(null);
    const [warehouseResourceType, setWarehouseResourceType] = useState('all');
    const [silverGoldAmount, setSilverGoldAmount] = useState(10);

    const [cropperType, setCropperType] = useState('9');
    const [cropperResults, setCropperResults] = useState(null);
    const [cropperSearching, setCropperSearching] = useState(false);

    const [troopShop, setTroopShop] = useState({ troops: [], animals: [] });
    const [qty, setQty] = useState({});
    const [pkgs, setPkgs] = useState({});
    const [bundleMult, setBundleMult] = useState(100);
    const [shopCurrency, setShopCurrency] = useState('gold');
    const [resourceBonusType, setResourceBonusType] = useState('all');

    const refreshGoldCoins = async () => {
        const { data } = await api.get('auth/me/');
        setUser(data);
    };

    useEffect(() => {
        api.get('game/gold/buy-gold-club/').then(({ data }) => setGoldClubStatus(data)).catch(() => {});
        api.get('game/gold/exchange-silver/').then(({ data }) => setSilverStatus(data)).catch(() => {});
        api.get('game/gold/troop-shop/').then(({ data }) => setTroopShop(data)).catch(() => {});
    }, []);

    const runAction = async (busyKey, request, onSuccess) => {
        setBusy(busyKey);
        try {
            const { data } = await request();
            setAlertMsg({ tone: 'success', text: data.message });
            await refreshGoldCoins();
            if (onSuccess) onSuccess(data);
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در انجام عملیات' });
        } finally {
            setBusy(null);
        }
    };

    const handleResourceBonus = () => {
        if (!activeVillageId) return;
        runAction('resource_bonus', () => api.post('game/gold/resource-bonus/', {
            village_id: activeVillageId, resource_type: resourceBonusType,
        }));
    };

    const handleBuyGoldClub = () => runAction('gold_club',
        () => api.post('game/gold/buy-gold-club/'),
        () => setGoldClubStatus((s) => ({ ...s, has_gold_club: true })));

    const handleBuyWarehouse = () => {
        if (!activeVillageId) return;
        runAction('warehouse', () => api.post('game/gold/buy-warehouse/', {
            village_id: activeVillageId, resource_type: warehouseResourceType,
        }));
    };

    const handleBuyProtection = () => runAction('buy_protection', () => api.post('game/gold/buy-protection/'));
    const handleExitProtection = () => runAction('exit_protection', () => api.post('game/gold/exit-protection/'));

    const handleInstantRallyPoint = () => {
        if (!activeVillageId) return;
        runAction('rally_point', () => api.post('game/gold/instant-rally-point/', { village_id: activeVillageId }));
    };

    const handleInstantConstruction = () => {
        if (!activeVillageId) return;
        runAction('instant_construction', () => api.post('game/gold/instant-construction/', { village_id: activeVillageId }));
    };

    const handleExchangeSilver = () => {
        runAction('exchange_silver',
            () => api.post('game/gold/exchange-silver/', { gold_amount: silverGoldAmount }),
            (data) => setSilverStatus((s) => ({ ...s, gold_coins: data.gold_coins, silver_coins: data.silver_coins })));
    };

    const handleCropperSearch = async () => {
        if (!activeVillage) return;
        setCropperSearching(true);
        try {
            const { data } = await api.get('game/gold/cropper-search/', {
                params: { x: activeVillage.x_coord, y: activeVillage.y_coord, type: cropperType, radius: 30 },
            });
            setCropperResults(data);
        } catch (error) {
            setAlertMsg({ tone: 'error', text: error.response?.data?.error || 'خطا در جستجو' });
        } finally {
            setCropperSearching(false);
        }
    };

    // Shop actions
    const stepQty = useCallback((key, step) => {
        setQty((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) + step) }));
    }, []);

    const setQtyVal = useCallback((key, val) => {
        setQty((prev) => ({ ...prev, [key]: val }));
    }, []);

    const setPkgVal = useCallback((key, val) => {
        setPkgs((prev) => ({ ...prev, [key]: val }));
    }, []);

    const handleBuySingle = (item) => {
        const q = qty[`${item.type}-${item.id}`] || 0;
        if (q <= 0 || !activeVillageId) return;
        runAction(`troopshop-${item.type}-${item.id}`, () => api.post('game/gold/troop-shop/', {
            village_id: activeVillageId, item_id: item.id, item_type: item.type,
            quantity: q, currency: shopCurrency,
        }));
    };

    const handleBulkTroops = () => {
        if (!activeVillageId || !troopShop.troops.length) return;
        const items = troopShop.troops
            .map((t) => ({ troop_id: t.id, quantity: qty[`troop-${t.id}`] || 0 }))
            .filter((i) => i.quantity > 0);
        if (items.length === 0) return;
        runAction('bulk-troops', () => api.post('game/gold/bulk-troop-buy/', {
            village_id: activeVillageId, items, currency: shopCurrency,
        }));
    };

    const handleBulkAnimals = () => {
        if (!activeVillageId || !troopShop.animals.length) return;
        const items = troopShop.animals
            .map((a) => ({ animal_id: a.id, quantity: qty[`animal-${a.id}`] || 0 }))
            .filter((i) => i.quantity > 0);
        if (items.length === 0) return;
        runAction('bulk-animals', () => api.post('game/gold/bulk-animal-buy/', {
            village_id: activeVillageId, items, currency: shopCurrency,
        }));
    };

    const applyBundle = useCallback((mult) => {
        setQty((prev) => {
            const next = { ...prev };
            troopShop.animals.forEach((a) => { next[`animal-${a.id}`] = mult; });
            return next;
        });
    }, [troopShop.animals]);

    // Totals
    const totalTroopsInCart = troopShop.troops.reduce((s, t) => s + (qty[`troop-${t.id}`] || 0), 0);
    const totalTroopsCost = troopShop.troops.reduce((s, t) => {
        const p = shopCurrency === 'gold' ? t.gold_price : t.silver_price;
        return s + p * (qty[`troop-${t.id}`] || 0);
    }, 0);
    const totalAnimalsInCart = troopShop.animals.reduce((s, a) => s + (qty[`animal-${a.id}`] || 0), 0);
    const totalAnimalsCost = troopShop.animals.reduce((s, a) => {
        const p = shopCurrency === 'gold' ? a.gold_price : a.silver_price;
        return s + p * (qty[`animal-${a.id}`] || 0);
    }, 0);

    const unit = shopCurrency === 'gold' ? '💰' : '🪙';

    // Group troops by category
    const infantry = troopShop.troops.filter((t) => !t.is_cavalry && !t.is_siege_weapon);
    const cavalry = troopShop.troops.filter((t) => t.is_cavalry);
    const siege = troopShop.troops.filter((t) => t.is_siege_weapon);

    return (
        <>
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="امکانات طلایی" />

            {/* Protection */}
            <WoodSign title="🛡️ محافظت تازه‌وارد" icon="🛡️">
                <p className="text-xs text-ink-500 mb-3">خرید یا لغو فوری محافظت تازه‌وارد در ازای طلا.</p>
                <div className="flex gap-2">
                    <button onClick={handleBuyProtection} disabled={busy === 'buy_protection'} className="btn-primary flex-1 text-xs">
                        {busy === 'buy_protection' ? '...' : 'خرید محافظت'}
                    </button>
                    <button onClick={handleExitProtection} disabled={busy === 'exit_protection'} className="btn-danger flex-1 text-xs">
                        {busy === 'exit_protection' ? '...' : 'خروج از محافظت'}
                    </button>
                </div>
            </WoodSign>

            {/* Instant features */}
            <WoodSign title="⚡ امکانات فوری دهکده فعال" icon="⚡">
                <p className="text-xs text-ink-500 mb-3">این گزینه‌ها روی دهکده‌ی فعال شما ({activeVillage?.name || '—'}) اعمال می‌شوند.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center gap-2 md:col-span-2">
                        <select value={resourceBonusType} onChange={(e) => setResourceBonusType(e.target.value)} className="field text-xs">
                            {RESOURCE_BONUS_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <button onClick={handleResourceBonus} disabled={busy === 'resource_bonus' || !activeVillageId} className="btn-gold text-xs flex-1">
                            {busy === 'resource_bonus' ? '...' : 'بونوس ۲۵٪ تولید (۲۴ ساعت) — ۵۰ 💰'}
                        </button>
                    </div>
                    <button onClick={handleInstantRallyPoint} disabled={busy === 'rally_point' || !activeVillageId} className="btn-gold text-xs">
                        {busy === 'rally_point' ? '...' : 'محل گردهمایی فوری — ۵۰ 💰'}
                    </button>
                    <button onClick={handleInstantConstruction} disabled={busy === 'instant_construction' || !activeVillageId} className="btn-gold text-xs md:col-span-2">
                        {busy === 'instant_construction' ? '...' : 'تکمیل فوری صف ساخت — ۳۰ 💰/ساختمان'}
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <select value={warehouseResourceType} onChange={(e) => setWarehouseResourceType(e.target.value)} className="field text-xs">
                        {RESOURCE_BONUS_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <button onClick={handleBuyWarehouse} disabled={busy === 'warehouse' || !activeVillageId} className="btn-gold text-xs flex-1">
                        {busy === 'warehouse' ? '...' : 'پر کردن فوری انبار/سیلو — ۲ 💰/۱۰۰۰ واحد'}
                    </button>
                </div>
            </WoodSign>

            {/* Silver exchange */}
            <WoodSign title="💱 تبدیل طلا به نقره" icon="💱">
                <p className="text-xs text-ink-500 mb-2">{silverStatus?.exchange_rate}</p>
                <p className="text-xs text-ink-600 mb-3">موجودی نقره: {fmt(silverStatus?.silver_coins ?? 0)}</p>
                <div className="flex gap-2">
                    <input type="number" min="10" step="10" value={silverGoldAmount} onChange={(e) => setSilverGoldAmount(parseInt(e.target.value, 10) || 10)} className="field w-24 text-center text-xs" />
                    <button onClick={handleExchangeSilver} disabled={busy === 'exchange_silver'} className="btn-gold flex-1 text-xs">
                        {busy === 'exchange_silver' ? '...' : 'تبدیل به نقره'}
                    </button>
                </div>
            </WoodSign>

            {/* Gold Club */}
            <WoodSign title="⭐ کلوپ طلایی" icon="⭐">
                {goldClubStatus?.has_gold_club ? (
                    <p className="text-sm font-bold text-brand-700 text-center py-2">شما عضو کلوپ طلایی هستید.</p>
                ) : (
                    <button onClick={handleBuyGoldClub} disabled={busy === 'gold_club'} className="btn-gold w-full text-xs">
                        {busy === 'gold_club' ? '...' : `خرید کلوپ طلایی (${goldClubStatus?.cost ?? '—'} 💰)`}
                    </button>
                )}
                <p className="text-[11px] text-ink-500 mt-2">کلوپ طلایی، لیست مزرعه، تنظیم فرار نیرو، و جستجوی دهکده‌های ۹ و ۱۵ گندمی را باز می‌کند.</p>
            </WoodSign>

            {/* Cropper search */}
            {goldClubStatus?.has_gold_club && (
                <WoodSign title="🔍 جستجوی دهکده‌های ۹ و ۱۵ گندمی" icon="🔍">
                    <div className="flex gap-2 mb-3">
                        <button onClick={() => setCropperType('9')} className={`flex-1 text-xs py-2 rounded-lg border-2 font-bold ${cropperType === '9' ? 'border-gold-500 bg-gold-50' : 'border-parchment-300'}`}>۹ گندمی</button>
                        <button onClick={() => setCropperType('15')} className={`flex-1 text-xs py-2 rounded-lg border-2 font-bold ${cropperType === '15' ? 'border-gold-500 bg-gold-50' : 'border-parchment-300'}`}>۱۵ گندمی</button>
                    </div>
                    <button onClick={handleCropperSearch} disabled={cropperSearching || !activeVillage} className="btn-primary w-full text-xs mb-3">
                        {cropperSearching ? 'در حال جستجو...' : 'جستجو در اطراف دهکده فعال'}
                    </button>
                    {cropperResults && (
                        cropperResults.results.length === 0 ? (
                            <p className="text-xs text-ink-400 text-center">هیچ دهکده‌ای از این نوع یافت نشد.</p>
                        ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {cropperResults.results.map((r) => (
                                    <div key={r.id} className="flex justify-between gap-2 text-xs bg-parchment-50 border border-parchment-200 rounded-lg px-3 py-1.5">
                                        <span className="font-bold truncate">{r.name}</span>
                                        <span dir="ltr" className="flex-shrink-0">({r.x_coord}|{r.y_coord})</span>
                                        <span className="truncate">{r.player_name}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </WoodSign>
            )}

            {/* ========== GOLDEN TROOP SHOP ========== */}
            <WoodSign title="⚔️ فروشگاه نیروی طلایی" icon="⚔️">
                <div className="flex items-center justify-end gap-2 mb-3">
                    <span className="text-xs font-bold text-ink-600">پرداخت با:</span>
                    <select value={shopCurrency} onChange={(e) => setShopCurrency(e.target.value)} className="field text-xs !w-24">
                        <option value="gold">💰 طلا</option>
                        <option value="silver">🪙 نقره</option>
                    </select>
                </div>

                {troopShop.troops.length === 0 && troopShop.animals.length === 0 ? (
                    <p className="text-xs text-ink-400 text-center py-3">در حال بارگذاری فروشگاه...</p>
                ) : (
                    <div className="space-y-4 max-h-[40rem] overflow-y-auto">

                        {/* ===== TROOPS ===== */}
                        {troopShop.troops.length > 0 && (
                            <>
                                {/* Infantry */}
                                {infantry.length > 0 && (
                                    <div>
                                        <div className="text-[11px] font-bold text-ink-600 uppercase tracking-wide px-1 mb-2 flex items-center justify-between">
                                            <span>نیروی پیاده</span>
                                            <span className="text-ink-400 normal-case">{infantry.length} نوع</span>
                                        </div>
                                        <div className="space-y-2">
                                            {infantry.map((t) => (
                                                <TroopCard key={t.id} item={t} qty={qty[`troop-${t.id}`] || 0} pkg={pkgs[`troop-${t.id}`] || 1} onStep={stepQty} onSetQty={setQtyVal} onSetPkg={setPkgVal} onBuy={handleBuySingle} busy={busy} currency={shopCurrency} villageId={activeVillageId} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Cavalry */}
                                {cavalry.length > 0 && (
                                    <div>
                                        <div className="text-[11px] font-bold text-ink-600 uppercase tracking-wide px-1 mb-2 flex items-center justify-between">
                                            <span>نیروی سواره</span>
                                            <span className="text-ink-400 normal-case">{cavalry.length} نوع</span>
                                        </div>
                                        <div className="space-y-2">
                                            {cavalry.map((t) => (
                                                <TroopCard key={t.id} item={t} qty={qty[`troop-${t.id}`] || 0} pkg={pkgs[`troop-${t.id}`] || 1} onStep={stepQty} onSetQty={setQtyVal} onSetPkg={setPkgVal} onBuy={handleBuySingle} busy={busy} currency={shopCurrency} villageId={activeVillageId} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Siege */}
                                {siege.length > 0 && (
                                    <div>
                                        <div className="text-[11px] font-bold text-ink-600 uppercase tracking-wide px-1 mb-2 flex items-center justify-between">
                                            <span>نیروی محاصره</span>
                                            <span className="text-ink-400 normal-case">{siege.length} نوع</span>
                                        </div>
                                        <div className="space-y-2">
                                            {siege.map((t) => (
                                                <TroopCard key={t.id} item={t} qty={qty[`troop-${t.id}`] || 0} pkg={pkgs[`troop-${t.id}`] || 1} onStep={stepQty} onSetQty={setQtyVal} onSetPkg={setPkgVal} onBuy={handleBuySingle} busy={busy} currency={shopCurrency} villageId={activeVillageId} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Troop bulk bar */}
                                {totalTroopsInCart > 0 && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-green-700">سبد نیروها: <b>{fmt(totalTroopsInCart)}</b> عدد — <b className="text-gold-600">{fmt(totalTroopsCost)} {unit}</b></span>
                                            <button onClick={handleBulkTroops} disabled={busy === 'bulk-troops' || !activeVillageId} className="btn-gold text-xs !px-3 !py-1">
                                                {busy === 'bulk-troops' ? '...' : 'خرید همه نیروها'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ===== ANIMALS ===== */}
                        {troopShop.animals.length > 0 && (
                            <>
                                <div>
                                    <div className="text-[11px] font-bold text-ink-600 uppercase tracking-wide px-1 mb-2 flex items-center justify-between">
                                        <span>حیوانات نگهبان</span>
                                        <span className="text-ink-400 normal-case">{troopShop.animals.length} نوع</span>
                                    </div>

                                    {/* Bundle bar */}
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold text-amber-700">بسته همه حیوانات</span>
                                            <div className="flex items-center gap-0.5">
                                                <button onClick={() => applyBundle(Math.max(0, (qty[`animal-${troopShop.animals[0]?.id}`] || 0) - bundleMult))} className="w-6 h-6 rounded bg-amber-200 hover:bg-amber-300 text-xs font-bold flex items-center justify-center">−</button>
                                                <button onClick={() => applyBundle((qty[`animal-${troopShop.animals[0]?.id}`] || 0) + bundleMult)} className="w-6 h-6 rounded bg-amber-200 hover:bg-amber-300 text-xs font-bold flex items-center justify-center">+</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {BUNDLE_PACKAGES.map((p) => (
                                                <button key={p} onClick={() => setBundleMult(p)} className={`text-[10px] px-2 py-0.5 rounded border font-bold transition-colors ${bundleMult === p ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-ink-600 border-parchment-300 hover:border-amber-400'}`}>
                                                    {p >= 1000 ? `${p / 1000}K` : p}
                                                </button>
                                            ))}
                                            <span className="text-[10px] text-ink-400">عدد هر حیوان</span>
                                        </div>
                                        {totalAnimalsInCart > 0 && (
                                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200">
                                                <span className="text-[11px] text-amber-600">
                                                    جمع سبد: <b>{fmt(totalAnimalsInCart)}</b> حیوان — <b className="text-gold-600">{fmt(totalAnimalsCost)} {unit}</b>
                                                </span>
                                                <button onClick={handleBulkAnimals} disabled={busy === 'bulk-animals' || !activeVillageId} className="btn-gold text-xs !px-3 !py-1">
                                                    {busy === 'bulk-animals' ? '...' : 'خرید همه حیوانات'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {troopShop.animals.map((a) => (
                                            <AnimalCard key={a.id} item={a} qty={qty[`animal-${a.id}`] || 0} pkg={pkgs[`animal-${a.id}`] || 100} onStep={stepQty} onSetQty={setQtyVal} onSetPkg={setPkgVal} onBuy={handleBuySingle} busy={busy} currency={shopCurrency} villageId={activeVillageId} />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </WoodSign>
        </>
    );
}
