import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import WoodSign from './WoodSign';
import { AlertModal } from './Modal';
import useGameStore from '../store/useGameStore';

const RESOURCE_BONUS_TYPES = [
    { value: 'all', label: 'همه منابع', image: '/assets/ui/res-5.gif' },
    { value: 'wood', label: '🪵 چوب', image: '/assets/ui/res-1.gif' },
    { value: 'clay', label: '🧱 خشت', image: '/assets/ui/res-2.gif' },
    { value: 'iron', label: '⚒️ آهن', image: '/assets/ui/res-3.gif' },
    { value: 'crop', label: '🌾 گندم', image: '/assets/ui/res-4.gif' },
];

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
    const [troopShopQty, setTroopShopQty] = useState({});

    const [resourceBonusType, setResourceBonusType] = useState('all');

    const handleResourceBonus = () => {
        if (!activeVillageId) return;
        runAction('resource_bonus', () => api.post('game/gold/resource-bonus/', {
            village_id: activeVillageId, resource_type: resourceBonusType,
        }));
    };


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

    const handleBuyTroopShopItem = (item) => {
        const quantity = troopShopQty[`${item.type}-${item.id}`] || 0;
        if (quantity <= 0 || !activeVillageId) return;
        runAction(`troopshop-${item.type}-${item.id}`, () => api.post('game/gold/troop-shop/', {
            village_id: activeVillageId, item_id: item.id, item_type: item.type, quantity,
        }));
    };

    const allShopItems = [
        ...troopShop.troops.map((t) => ({ ...t })),
        ...troopShop.animals.map((a) => ({ ...a })),
    ];

    return (
        <>
            <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} tone={alertMsg?.tone} message={alertMsg?.text} title="امکانات طلایی" />

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

            <WoodSign title="⚡ امکانات فوری دهکده فعال" icon="⚡">
                <p className="text-xs text-ink-500 mb-3">
                    این گزینه‌ها روی دهکده‌ی فعال شما ({activeVillage?.name || '—'}) اعمال می‌شوند.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    <div className="flex items-center gap-2 md:col-span-2">
                        <select value={resourceBonusType} onChange={(e) => setResourceBonusType(e.target.value)} className="field text-xs">
                            {RESOURCE_BONUS_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <button onClick={handleResourceBonus} disabled={busy === 'resource_bonus' || !activeVillageId} className="btn-gold text-xs flex-1">
                            {busy === 'resource_bonus' ? '...' : '🚀 بونوس ۲۵٪ تولید (۲۴ ساعت)'}
                        </button>
                    </div>
                    <button onClick={handleInstantRallyPoint} disabled={busy === 'rally_point' || !activeVillageId} className="btn-gold text-xs">
                        {busy === 'rally_point' ? '...' : '🚩 ساخت فوری محل گردهمایی'}
                    </button>
                    <button onClick={handleInstantConstruction} disabled={busy === 'instant_construction' || !activeVillageId} className="btn-gold text-xs md:col-span-2">
                        {busy === 'instant_construction' ? '...' : '🔨 تکمیل فوری صف ساخت (به‌جز قصر/اقامتگاه)'}
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <select value={warehouseResourceType} onChange={(e) => setWarehouseResourceType(e.target.value)} className="field text-xs">
                        {RESOURCE_BONUS_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <button onClick={handleBuyWarehouse} disabled={busy === 'warehouse' || !activeVillageId} className="btn-gold text-xs flex-1">
                        {busy === 'warehouse' ? '...' : '📦 پر کردن فوری انبار/سیلو'}
                    </button>
                </div>
            </WoodSign>

            <WoodSign title="💱 تبدیل طلا به نقره" icon="💱">
                <p className="text-xs text-ink-500 mb-2">{silverStatus?.exchange_rate}</p>
                <p className="text-xs text-ink-600 mb-3">موجودی نقره: {silverStatus?.silver_coins ?? 0}</p>
                <div className="flex gap-2">
                    <input
                        type="number" min="10" step="10" value={silverGoldAmount}
                        onChange={(e) => setSilverGoldAmount(parseInt(e.target.value, 10) || 10)}
                        className="field w-24 text-center text-xs"
                    />
                    <button onClick={handleExchangeSilver} disabled={busy === 'exchange_silver'} className="btn-gold flex-1 text-xs">
                        {busy === 'exchange_silver' ? '...' : 'تبدیل به نقره'}
                    </button>
                </div>
            </WoodSign>

            <WoodSign title="⭐ کلوپ طلایی" icon="⭐">
                {goldClubStatus?.has_gold_club ? (
                    <p className="text-sm font-bold text-brand-700 text-center py-2">✅ شما عضو کلوپ طلایی هستید.</p>
                ) : (
                    <button onClick={handleBuyGoldClub} disabled={busy === 'gold_club'} className="btn-gold w-full text-xs">
                        {busy === 'gold_club' ? '...' : `خرید کلوپ طلایی (${goldClubStatus?.cost ?? '—'} 💰)`}
                    </button>
                )}
                <p className="text-[11px] text-ink-500 mt-2">
                    کلوپ طلایی، لیست مزرعه، تنظیم فرار نیرو، و جستجوی دهکده‌های ۹ و ۱۵ گندمی را باز می‌کند.
                </p>
            </WoodSign>

            {goldClubStatus?.has_gold_club && (
                <WoodSign title="🔍 جستجوی دهکده‌های ۹ و ۱۵ گندمی" icon="🔍">
                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => setCropperType('9')}
                            className={`flex-1 text-xs py-2 rounded-lg border-2 font-bold ${cropperType === '9' ? 'border-gold-500 bg-gold-50' : 'border-parchment-300'}`}
                        >
                            ۹ گندمی
                        </button>
                        <button
                            onClick={() => setCropperType('15')}
                            className={`flex-1 text-xs py-2 rounded-lg border-2 font-bold ${cropperType === '15' ? 'border-gold-500 bg-gold-50' : 'border-parchment-300'}`}
                        >
                            ۱۵ گندمی
                        </button>
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

            <WoodSign title="⚔️ فروشگاه نیروی طلایی" icon="⚔️">
                {allShopItems.length === 0 ? (
                    <p className="text-xs text-ink-400 text-center py-3">در حال بارگذاری فروشگاه...</p>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {allShopItems.map((item) => {
                            const key = `${item.type}-${item.id}`;
                            return (
                                <div key={key} className="flex items-center justify-between gap-2 bg-parchment-50 border border-parchment-200 rounded-lg px-3 py-2">
                                    <span className="text-xs font-bold flex-1">{item.name} ({item.gold_price} 💰/عدد)</span>
                                    <input
                                        type="number" min="0" value={troopShopQty[key] || ''}
                                        onChange={(e) => setTroopShopQty((prev) => ({ ...prev, [key]: parseInt(e.target.value, 10) || 0 }))}
                                        className="field w-16 text-center text-xs"
                                    />
                                    <button
                                        onClick={() => handleBuyTroopShopItem(item)}
                                        disabled={busy === `troopshop-${key}` || !activeVillageId}
                                        className="btn-gold text-xs !px-3 !py-1.5"
                                    >
                                        {busy === `troopshop-${key}` ? '...' : 'خرید'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </WoodSign>
        </>
    );
}
